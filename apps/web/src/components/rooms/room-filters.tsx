"use client";

import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import { LANGUAGES, LANGUAGE_LABELS, TOPICS, type RoomSort } from "@gistroom/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Modal } from "@/components/ui/modal";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Select } from "@/components/ui/select";
import { discover } from "@/content/discover";
import { roomCards as copy } from "@/content/room-cards";
import { cn } from "@/lib/cn";

export interface RoomFilterValue {
  /** Topic slug, or an empty string for any topic. */
  topic: string;
  /** Upper case language, or "all". */
  language: string;
  sort: RoomSort;
}

export const NO_FILTERS: RoomFilterValue = { topic: "", language: "all", sort: "active" };

/** How many of topic and language are set. Sort is a preference, not a filter. */
export function activeFilterCount(v: RoomFilterValue): number {
  return (v.topic ? 1 : 0) + (v.language !== "all" ? 1 : 0);
}

const topicOptions = [
  { value: "", label: copy.filters.anyTopic },
  ...TOPICS.map((t) => ({ value: t.slug, label: t.name })),
];
const languageOptions = [
  { value: "all", label: copy.filters.anyLanguage },
  ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] })),
];

/**
 * Filters in a wide dialog with grouped controls, room for long labels, Reset and Apply. Nothing changes the list until
 * Apply, Escape or a click outside closes it without applying, and every control is a shared Select or Combobox.
 */
export function RoomFilterButton({
  value,
  onApply,
  showSort = false,
  className,
}: {
  value: RoomFilterValue;
  onApply: (next: RoomFilterValue) => void;
  showSort?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomFilterValue>(value);
  const count = activeFilterCount(value);

  return (
    <>
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        aria-label={count > 0 ? copy.filters.openWithCount(count) : copy.filters.open}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className={cn("gap-2", className)}
      >
        <ListFilter aria-hidden className="size-4" />
        {copy.filters.open}
        {count > 0 ? (
          <span className="tabular rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-ink-950">
            {count}
          </span>
        ) : null}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        icon={ListFilter}
        title={copy.filters.title}
        description={copy.filters.lead}
        className="w-[min(94vw,38rem)]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft({ ...NO_FILTERS, sort: draft.sort })}>
              {copy.filters.reset}
            </Button>
            <Button
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              {copy.filters.apply}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="room-filter-topic" className="text-sm font-semibold text-text">
              {copy.filters.topic}
            </label>
            <Combobox
              id="room-filter-topic"
              value={draft.topic}
              onValueChange={(topic) => setDraft((d) => ({ ...d, topic }))}
              options={topicOptions}
              placeholder={copy.filters.anyTopic}
              searchLabel={copy.filters.topicSearch}
              emptyText={copy.filters.topicEmpty}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="room-filter-language" className="text-sm font-semibold text-text">
              {copy.filters.language}
            </label>
            <Select
              id="room-filter-language"
              value={draft.language}
              onValueChange={(language) => setDraft((d) => ({ ...d, language }))}
              options={languageOptions}
              placeholder={copy.filters.anyLanguage}
            />
          </div>
          {showSort ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text">{copy.filters.sort}</span>
              <SegmentedTabs
                label={discover.filters.sort}
                value={draft.sort}
                onChange={(v) => setDraft((d) => ({ ...d, sort: v as RoomSort }))}
                options={[
                  { value: "active", label: discover.filters.active },
                  { value: "newest", label: discover.filters.newest },
                ]}
              />
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

/** The filters that are on, each with a button to remove it, so nothing is hidden behind the dialog. */
export function ActiveFilters({
  value,
  onChange,
}: {
  value: RoomFilterValue;
  onChange: (next: RoomFilterValue) => void;
}) {
  const items: { key: string; label: string; clear: () => void }[] = [];
  if (value.topic) {
    const name = TOPICS.find((t) => t.slug === value.topic)?.name ?? value.topic;
    items.push({ key: "topic", label: name, clear: () => onChange({ ...value, topic: "" }) });
  }
  if (value.language !== "all") {
    const name = LANGUAGE_LABELS[value.language as keyof typeof LANGUAGE_LABELS] ?? value.language;
    items.push({
      key: "language",
      label: name,
      clear: () => onChange({ ...value, language: "all" }),
    });
  }
  if (items.length === 0) return null;
  return (
    <ul aria-label={copy.filters.selected} className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <li key={i.key}>
          <button
            type="button"
            aria-label={copy.filters.clearOne(i.label)}
            onClick={i.clear}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green-100 px-4 text-sm font-semibold text-green-700 hover:bg-green-100/70"
          >
            {i.label}
            <X aria-hidden className="size-4" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => onChange({ ...NO_FILTERS, sort: value.sort })}
          className="min-h-11 px-2 text-sm font-semibold text-text-muted underline-offset-4 hover:underline"
        >
          {copy.filters.clearAll}
        </button>
      </li>
    </ul>
  );
}
