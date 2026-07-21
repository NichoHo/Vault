package id

import (
	"strings"
	"testing"
)

func TestPasswordRoundTrip(t *testing.T) {
	h, err := HashPassword("hunter2!")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$") {
		t.Fatalf("bad format %q", h)
	}
	if ok, err := VerifyPassword("hunter2!", h); err != nil || !ok {
		t.Fatalf("want match, got ok=%v err=%v", ok, err)
	}
	if ok, _ := VerifyPassword("wrong", h); ok {
		t.Fatal("want mismatch")
	}
	if _, err := VerifyPassword("x", "$nonsense"); err == nil {
		t.Fatal("want error on garbage hash")
	}
}
