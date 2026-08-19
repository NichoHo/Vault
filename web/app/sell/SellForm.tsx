"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/api";
import { createListingAction, suggestAction, type Suggestion } from "./actions";

const base =
  "rounded-control border bg-surface text-ink px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-primary";

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
            : "The assistant is unavailable right now. Fill the fields in yourself.",
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
          ? "Drafted from your hint and recent sale prices. No vision model is configured."
          : `Suggested by ${result.model}. Edit anything before you list it.`,
      );
    });
  }

  // map form fields → assist's field names, keeping only unedited AI fields
  const acceptedFields = [...aiFields]
    .map((f) => (f === "category_id" ? "category" : f))
    .join(",");

  const ai = (name: keyof Fields) =>
    `${base} ${aiFields.has(name) ? "border-l-4 border-primary" : "border-line"}`;

  return (
    <form action={createListingAction} className="flex flex-col gap-3">
      {hadError ? (
        <p className="rounded-control bg-danger-tint px-3.5 py-2.5 text-sm text-danger">
          Could not create the listing. Check the fields and try again.
        </p>
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
      <div className="flex gap-2">
        <input
          name="image_url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          aria-label="Photo URL"
          placeholder="Photo URL"
          className={`${base} border-line flex-1`}
        />
        <button
          type="button"
          onClick={requestSuggestion}
          disabled={pending || (!imageUrl && !fields.title)}
          className="inline-flex shrink-0 items-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-on-solid shadow-sm transition-colors hover:bg-primary-strong disabled:opacity-45 disabled:shadow-none disabled:hover:bg-primary"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`}
          >
            <path d="M10.5 3.5 12.3 8.2 17 10l-4.7 1.8-1.8 4.7-1.8-4.7L4 10l4.7-1.8z" />
            <path d="M17.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
          </svg>
          {pending ? "Suggesting…" : "Suggest"}
        </button>
      </div>
      <p aria-live="polite" className="text-xs leading-5 text-faint empty:hidden">
        {note}
      </p>
      {imageUrl ? (
        <img src={imageUrl} alt="Listing photo preview" className="max-h-48 rounded-card object-cover" />
      ) : null}
      <textarea
        name="description"
        rows={4}
        aria-label="Description"
        placeholder="Description: condition, age, what's included"
        value={fields.description}
        onChange={(e) => setField("description", e.target.value)}
        className={ai("description")}
      />
      <div className="flex gap-3">
        <label className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
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
        {/* appearance-none + our own chevron: the native arrow sits hard against
            the right edge, which reads unbalanced against the 14px text inset. */}
        <div className="relative flex-1">
          <select
            name="category_id"
            aria-label="Category"
            value={fields.category_id}
            onChange={(e) => setField("category_id", e.target.value)}
            className={`${ai("category_id")} w-full appearance-none pr-10`}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          >
            <path d="m6 9.5 6 6 6-6" />
          </svg>
        </div>
      </div>
      {suggestion?.price_low != null && suggestion?.price_high != null ? (
        <p className="money text-xs text-faint">
          Similar items sold for ¥{suggestion.price_low.toLocaleString("ja-JP")} to ¥
          {suggestion.price_high.toLocaleString("ja-JP")}
        </p>
      ) : null}

      <input type="hidden" name="suggestion_id" value={suggestion?.suggestion_id ?? ""} />
      <input type="hidden" name="accepted_fields" value={suggestion ? acceptedFields : ""} />
      <button
        type="submit"
        className="mt-1 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-on-solid shadow-sm transition-colors hover:bg-primary-strong"
      >
        List it
      </button>
    </form>
  );
}
