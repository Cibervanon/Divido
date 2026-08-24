import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../lib/auth";
import { helpCategories, keyboardShortcuts, iconMeanings, expenseCategories, helpSearchIndex } from "../data/helpContent.ts";
import { Button, Input, Modal } from "./ui";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type HelpTab = "topics" | "shortcuts" | "icons" | "expense-categories" | "faq";

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<HelpTab>("topics");

  const filteredResults = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return helpSearchIndex.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [search]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "Escape") onClose();
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Ayuda y Soporte</h2>
          <span className="text-xs text-slate-500">v2.5.0</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      <div className="flex h-[60vh] flex-col overflow-hidden">
        {/* Header with search and tabs */}
        <div className="flex-shrink-0 border-b border-slate-800 p-4">
          <Input
            placeholder="Buscar en la ayuda... (atajo: ?)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
            rightElement={
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
          <div className="flex gap-1 overflow-x-auto pb-2" role="tablist">
            {([
              { id: "topics", label: "Temas" },
              { id: "shortcuts", label: "Atajos" },
              { id: "icons", label: "Iconos" },
              { id: "expense-categories", label: "Categorías" },
              { id: "faq", label: "FAQ" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search results */}
        {search && filteredResults.length > 0 && (
          <div className="p-4 border-b border-slate-800">
            <p className="text-xs text-slate-500 mb-2">{filteredResults.length} resultado(s) para "{search}"</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredResults.map((item: { id: string; title: string; category: string; categoryId: string; content: string }) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.categoryId === "faq") {
                      setActiveTab("faq");
                    } else {
                      setActiveTab("topics");
                    }
                    setSearch("");
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800 transition text-sm"
                >
                  <p className="font-medium text-slate-100 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 truncate">{item.category}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "topics" && (
            <div className="space-y-4">
              {helpCategories.map((category: { id: string; title: string; articles: Array<{ id: string; title: string; content: string }> }) => {
                const isExpanded = expandedCategories.includes(category.id);
                return (
                  <div key={category.id} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                    >
                      <span className="font-semibold text-slate-100">{category.title}</span>
                      <svg
                        className={`h-5 w-5 text-slate-400 transition-transform ${expandedCategories.includes(category.id) ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-slate-800 p-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-2">
                          {helpCategories.find(c => c.id === category.id)?.articles.map((article: { id: string; title: string; content: string }) => (
                            <div
                              key={article.id}
                              className="px-3 py-2 rounded-lg text-sm text-slate-100"
                            >
                              <p className="font-medium">{article.title}</p>
                              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{article.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="space-y-2">
              {keyboardShortcuts.map((shortcut: { key: string; description: string }) => (
                <div key={shortcut.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-400">{shortcut.key}</span>
                  <span className="text-sm text-slate-300 ml-3">{shortcut.description}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "icons" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {iconMeanings.map((icon: { icon: string; meaning: string }) => (
                <div key={icon.icon} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{icon.icon}</span>
                    <span className="text-xs text-slate-400">{icon.meaning}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "expense-categories" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {expenseCategories.map((cat: { name: string; icon: string; keywords: string }) => (
                <div key={cat.name} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="font-medium text-slate-100">{cat.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">{cat.keywords}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "faq" && (
            <div className="space-y-2">
              {helpCategories.flatMap((c: { id: string; articles: Array<{ faqs?: Array<{ question: string; answer: string }> }> }) => c.articles.flatMap((a: { faqs?: Array<{ question: string; answer: string }> }) => a.faqs || []).map((faq: { question: string; answer: string }, i: number) => (
                <details key={`${c.id}-faq-${i}`} className="rounded-xl bg-slate-900 border border-slate-800">
                  <summary className="p-3 font-medium text-slate-100 cursor-pointer">{faq.question}</summary>
                  <div className="px-4 pb-3 text-slate-300 text-sm">{faq.answer}</div>
                </details>
              )))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}