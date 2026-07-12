"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/app/actions/categories";

// A category row as served by the Month page (serialisable — no Prisma types).
export type CategoryRow = { id: string; name: string; count: number };

// Inline styles mirror BackupRestore / PurchaseForm — all driven by the shared
// design tokens in globals.css, so the panel is theme-aware with no new globals.
const s = {
  field: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    fontSize: 15,
    background: "var(--card)",
    color: "var(--ink)",
    fontFamily: "inherit",
  },
  primaryBtn: {
    border: 0,
    borderRadius: 12,
    padding: "11px 16px",
    fontSize: 15,
    fontWeight: 700,
    background: "var(--green)",
    color: "#fff",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  softBtn: {
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--card)",
    color: "var(--ink)",
    cursor: "pointer",
  },
  dangerBtn: {
    border: "1px solid var(--red)",
    borderRadius: 10,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--card)",
    color: "var(--red)",
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

export default function CategoryManager({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  // Which row is currently being renamed, and the editable draft name.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  // Which row is showing its inline delete confirm.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  async function onAdd() {
    if (busy) return;
    const name = newName.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createCategory(name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNewName("");
      flash("Category added ✓");
      router.refresh();
    } catch {
      setError("Couldn't add that category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRename(id: string) {
    if (busy) return;
    const name = editName.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await renameCategory(id, name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditId(null);
      setEditName("");
      flash("Renamed ✓");
      router.refresh();
    } catch {
      setError("Couldn't rename that category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteCategory(id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setConfirmId(null);
      flash(
        res.movedToUncategorized > 0
          ? `Deleted · ${res.movedToUncategorized} item${
              res.movedToUncategorized === 1 ? "" : "s"
            } now Uncategorized`
          : "Deleted ✓",
      );
      router.refresh();
    } catch {
      setError("Couldn't delete that category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Add a category */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category"
          aria-label="New category name"
          style={{ ...s.field, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          style={{ ...s.primaryBtn, opacity: busy ? 0.6 : 1 }}
        >
          Add
        </button>
      </div>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--red)",
            background: "var(--red-soft)",
            borderRadius: 10,
            padding: "8px 10px",
            margin: "0 0 12px",
          }}
        >
          {error}
        </p>
      )}

      {categories.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
          No categories yet — add one above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                padding: 10,
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "var(--card-2)",
              }}
            >
              {editId === c.id ? (
                // --- Rename mode -----------------------------------------
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label={`Rename ${c.name}`}
                    style={{ ...s.field, flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => onRename(c.id)}
                    disabled={busy}
                    style={{ ...s.primaryBtn, opacity: busy ? 0.6 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(null);
                      setEditName("");
                    }}
                    disabled={busy}
                    style={s.softBtn}
                  >
                    Cancel
                  </button>
                </div>
              ) : confirmId === c.id ? (
                // --- Delete confirm --------------------------------------
                <div>
                  <p style={{ fontSize: 13, margin: "0 0 10px", color: "var(--ink)" }}>
                    Delete &ldquo;<strong>{c.name}</strong>&rdquo;?{" "}
                    {c.count > 0
                      ? `${c.count} item${
                          c.count === 1 ? "" : "s"
                        } become Uncategorized.`
                      : "It has no items."}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      disabled={busy}
                      style={{
                        ...s.dangerBtn,
                        background: "var(--red)",
                        color: "#fff",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={busy}
                      style={s.softBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // --- Display mode ----------------------------------------
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                    {c.name}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--ink-faint)",
                        marginLeft: 6,
                      }}
                    >
                      {c.count} item{c.count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmId(null);
                      setEditId(c.id);
                      setEditName(c.name);
                    }}
                    style={s.softBtn}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditId(null);
                      setConfirmId(c.id);
                    }}
                    style={s.dangerBtn}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 104,
            transform: "translateX(-50%)",
            background: "#101828",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 70,
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
