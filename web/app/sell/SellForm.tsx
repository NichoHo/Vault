"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/api";
import { createListingAction, suggestAction, type Suggestion } from "./actions";

const base =
  "rounded-[6px] border bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-indigo";

type Fields = { title: string; description: string; category_id: string; price: string };
const EMPTY: Fields = { title: "", description: "", category_id: "", price: "" };

export default function SellForm({
  categories,
  hadError,
}: {
  categories: Category[];
  hadError: boolean;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  // fields currently showing an unedited AI suggestion (the indigo border cue)
  const [aiFields, setAiFields] = useState<Set<keyof Fields>>(new Set());
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function setField(name: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [name]: value }));
    setAiFields((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name); // edited → no longer "AI suggested"
      return next;
    });
  }

  function requestSuggestion() {
    setNote("");
    startTransition(async () => {
      const result = await suggestAction(imageUrl, fields.title);
      if ("error" in result) {
        setNote(
          result.error === "signed_out"
            ? "Sign in to use suggestions."
            : "The assistant is unavailable right now — fill things in manually.",
        );
        return;
      }
      setSuggestion(result);
      const cat = categories.find((c) => c.slug === result.category_slug);
      const mid =
        result.price_low != null && result.price_high != null
          ? String(Math.round((result.price_low + result.price_high) / 2))
          : "";
      setFields({
        title: result.title,
        description: result.description,
        category_id: cat ? String(cat.id) : "",
        price: mid,
      });
      setAiFields(new Set(["title", "description", "category_id", ...(mid ? ["price" as const] : [])]));
      setNote(
        result.model === "heuristic"
          ? "Draft from your hint + comparable prices (no vision model configured)."
          : `Suggested by ${result.model} — edit anything before listing.`,
      );
    });
  }

  // map form fields → assist's field names, keeping only unedited AI fields
  const acceptedFields = [...aiFields]
    .map((f) => (f === "category_id" ? "category" : f))
    .join(",");

  const ai = (name: keyof Fields) =>
    `${base} ${aiFields.has(name) ? "border-l-4 border-indigo" : "border-sumi-20"}`;

  return (
    <form action={createListingAction} className="flex flex-col gap-3">
      {hadError ? (
        <p className="rounded-[6px] bg-torii/10 px-3 py-2 text-sm text-torii">
          Could not create the listing. Check the fields and try again.
        </p>
      ) : null}

      <div className="flex gap-2">
        <input
          name="image_url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          aria-label="Photo URL"
          placeholder="Photo URL"
          className={`${base} border-sumi-20 flex-1`}
        />
        <button
          type="button"
          onClick={requestSuggestion}
          disabled={pending || (!imageUrl && !fields.title)}
          className="rounded-[6px] bg-indigo px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Suggesting…" : <><span aria-hidden="true">✨</span> Suggest</>}
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-sumi-40 empty:hidden">
        {note}
      </p>
      {imageUrl ? (
        <img src={imageUrl} alt="Listing photo preview" className="max-h-48 rounded-[6px] object-cover" />
      ) : null}

      <input
        name="title"
        required
        maxLength={120}
        aria-label="Title"
        placeholder="Title"
        value={fields.title}
        onChange={(e) => setField("title", e.target.value)}
        className={ai("title")}
      />
      <textarea
        name="description"
        rows={4}
        aria-label="Description"
        placeholder="Description — condition, age, what's included"
        value={fields.description}
        onChange={(e) => setField("description", e.target.value)}
        className={ai("description")}
      />
      <div className="flex gap-3">
        <label className="flex flex-1 items-center gap-2 text-sm text-sumi-60">
          ¥
          <input
            name="price"
            type="number"
            required
            min={1}
            step={1}
            placeholder="Price (yen)"
            value={fields.price}
            onChange={(e) => setField("price", e.target.value)}
            className={`${ai("price")} money w-full`}
          />
        </label>
        <select
          name="category_id"
          aria-label="Category"
          value={fields.category_id}
          onChange={(e) => setField("category_id", e.target.value)}
          className={`${ai("category_id")} flex-1`}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {suggestion?.price_low != null && suggestion?.price_high != null ? (
        <p className="money text-xs text-sumi-40">
          Comparable items sold for ¥{suggestion.price_low.toLocaleString("ja-JP")} – ¥
          {suggestion.price_high.toLocaleString("ja-JP")}
        </p>
      ) : null}

      <input type="hidden" name="suggestion_id" value={suggestion?.suggestion_id ?? ""} />
      <input type="hidden" name="accepted_fields" value={suggestion ? acceptedFields : ""} />
      <button type="submit" className="rounded-[6px] bg-torii px-4 py-2.5 font-medium text-white">
        List it
      </button>
    </form>
  );
}
