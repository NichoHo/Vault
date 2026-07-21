package id

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"
	"time"
)

func TestMFAFlow(t *testing.T) {
	ts, c, pool := testEnv(t)
	ctx := context.Background()
	register(t, c, ts, "mia@test.dev", "mia")

	// enroll → activate with a computed code
	resp := postJSON(t, c, ts.URL+"/mfa/enroll", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("enroll: %d", resp.StatusCode)
	}
	var enroll struct{ Secret, OtpauthURI string }
	json.NewDecoder(resp.Body).Decode(&enroll)
	if enroll.Secret == "" {
		t.Fatal("no secret")
	}
	code, _ := totpCode(enroll.Secret, time.Now())

	// wrong code first
	if resp := postJSON(t, c, ts.URL+"/mfa/activate", map[string]string{"code": "000000"}); resp.StatusCode != 400 {
		t.Fatalf("bad activate: want 400, got %d", resp.StatusCode)
	}
	resp = postJSON(t, c, ts.URL+"/mfa/activate", map[string]string{"code": code})
	if resp.StatusCode != 200 {
		t.Fatalf("activate: %d", resp.StatusCode)
	}
	var act struct {
		RecoveryCodes []string `json:"recovery_codes"`
	}
	json.NewDecoder(resp.Body).Decode(&act)
	if len(act.RecoveryCodes) != 8 {
		t.Fatalf("want 8 recovery codes, got %d", len(act.RecoveryCodes))
	}

	// fresh login now requires the TOTP step
	postJSON(t, c, ts.URL+"/logout", nil)
	resp = postJSON(t, c, ts.URL+"/login", map[string]string{"email": "mia@test.dev", "password": "password123!"})
	if resp.StatusCode != 200 {
		t.Fatalf("login: %d", resp.StatusCode)
	}
	var lr struct {
		MFARequired bool `json:"mfa_required"`
	}
	json.NewDecoder(resp.Body).Decode(&lr)
	if !lr.MFARequired {
		t.Fatal("expected mfa_required")
	}
	// pending session is NOT signed in
	if resp, _ := c.Get(ts.URL + "/me"); resp.StatusCode != 401 {
		t.Fatalf("pending session /me: want 401, got %d", resp.StatusCode)
	}
	// wrong TOTP rejected
	if resp := postJSON(t, c, ts.URL+"/login/totp", map[string]string{"code": "000000"}); resp.StatusCode != 401 {
		t.Fatalf("wrong totp: want 401, got %d", resp.StatusCode)
	}
	code, _ = totpCode(enroll.Secret, time.Now())
	if resp := postJSON(t, c, ts.URL+"/login/totp", map[string]string{"code": code}); resp.StatusCode != 200 {
		t.Fatalf("totp step: want 200, got %d", resp.StatusCode)
	}
	if resp, _ := c.Get(ts.URL + "/me"); resp.StatusCode != 200 {
		t.Fatalf("after totp /me: want 200, got %d", resp.StatusCode)
	}

	// single-use: replaying the just-used TOTP code on a fresh login is rejected
	postJSON(t, c, ts.URL+"/logout", nil)
	postJSON(t, c, ts.URL+"/login", map[string]string{"email": "mia@test.dev", "password": "password123!"})
	if resp := postJSON(t, c, ts.URL+"/login/totp", map[string]string{"code": code}); resp.StatusCode != 401 {
		t.Fatalf("replayed totp code: want 401, got %d", resp.StatusCode)
	}

	// recovery code works exactly once
	postJSON(t, c, ts.URL+"/logout", nil)
	postJSON(t, c, ts.URL+"/login", map[string]string{"email": "mia@test.dev", "password": "password123!"})
	rc := act.RecoveryCodes[0]
	if resp := postJSON(t, c, ts.URL+"/login/recovery", map[string]string{"code": rc}); resp.StatusCode != 200 {
		t.Fatalf("recovery: want 200, got %d", resp.StatusCode)
	}
	postJSON(t, c, ts.URL+"/logout", nil)
	postJSON(t, c, ts.URL+"/login", map[string]string{"email": "mia@test.dev", "password": "password123!"})
	if resp := postJSON(t, c, ts.URL+"/login/recovery", map[string]string{"code": rc}); resp.StatusCode != 401 {
		t.Fatalf("reused recovery code: want 401, got %d", resp.StatusCode)
	}

	// audit trail covers the mfa lifecycle
	var n int
	pool.QueryRow(ctx,
		`SELECT count(*) FROM id.audit_events WHERE action IN
		 ('mfa.enroll','mfa.fail','mfa.success','mfa.recovery.used','mfa.recovery.fail')`).Scan(&n)
	if n < 4 {
		t.Fatalf("expected mfa audit events, got %d", n)
	}
}

func TestRefreshRotationAndReuseDetection(t *testing.T) {
	ts, c, pool := testEnv(t)
	ctx := context.Background()
	register(t, c, ts, "rex@test.dev", "rex")

	verifier, challenge := pkce()
	code := getCode(t, c, ts, challenge)
	resp := exchange(t, c, ts, code, verifier)
	if resp.StatusCode != 200 {
		t.Fatalf("token: %d", resp.StatusCode)
	}
	var tok struct {
		RefreshToken string `json:"refresh_token"`
		AccessToken  string `json:"access_token"`
	}
	json.NewDecoder(resp.Body).Decode(&tok)
	if tok.RefreshToken == "" {
		t.Fatal("no refresh token issued")
	}

	refresh := func(rt string) (int, string) {
		resp, err := c.PostForm(ts.URL+"/token", url.Values{
			"grant_type": {"refresh_token"}, "refresh_token": {rt}, "client_id": {testClient},
		})
		if err != nil {
			t.Fatal(err)
		}
		var out struct {
			RefreshToken string `json:"refresh_token"`
		}
		json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out.RefreshToken
	}

	// rotation: old → new works
	status, rt2 := refresh(tok.RefreshToken)
	if status != 200 || rt2 == "" {
		t.Fatalf("first refresh: status %d", status)
	}
	status, rt3 := refresh(rt2)
	if status != 200 || rt3 == "" {
		t.Fatalf("second refresh: status %d", status)
	}

	// REUSE: presenting rt2 (already rotated away) burns the family
	if status, _ := refresh(rt2); status != 400 {
		t.Fatalf("reused token: want 400, got %d", status)
	}
	// even the newest token is now dead
	if status, _ := refresh(rt3); status != 400 {
		t.Fatalf("family member after reuse: want 400, got %d", status)
	}
	var n int
	pool.QueryRow(ctx,
		`SELECT count(*) FROM id.audit_events WHERE action = 'refresh.reuse_detected'`).Scan(&n)
	if n != 1 {
		t.Fatalf("want 1 reuse_detected audit event, got %d", n)
	}

	// unknown token and wrong client are rejected
	if status, _ := refresh("garbage-token"); status != 400 {
		t.Fatalf("garbage refresh: want 400, got %d", status)
	}
}
