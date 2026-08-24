import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { helpCategories, keyboardShortcuts, iconMeanings, expenseCategories, helpSearchIndex } from "../data/helpContent.ts";
import { Button, Input, Modal } from "./ui";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type HelpTab = "getting-started" | "topics" | "shortcuts" | "icons" | "expense-categories" | "faq";

interface ExpenseCategoryDetail {
  name: string;
  color: string;
  icon: string;
  keywords: string;
  articles: Array<{ id: string; title: string; content: string }>;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<HelpTab>("getting-started");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<ExpenseCategoryDetail | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (open && searchWrapperRef.current) {
      const input = searchWrapperRef.current.querySelector<HTMLInputElement>("input");
      input?.focus();
    }
  }, [open]);

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

  const handleSearchResultClick = (item: { categoryId: string }) => {
    if (item.categoryId === "faq") {
      setActiveTab("faq");
    } else if (item.categoryId === "sec-1") {
      setActiveTab("getting-started");
    } else {
      setActiveTab("topics");
    }
    setSearch("");
    // Blur search input by focusing the wrapper then removing focus
    const input = searchWrapperRef.current?.querySelector<HTMLInputElement>("input");
    input?.blur();
  };

  const getCategoryArticles = (categoryId: string) => {
    const cat = helpCategories.find(c => c.id === categoryId);
    return cat?.articles || [];
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "Escape") {
        if (selectedExpenseCategory) {
          setSelectedExpenseCategory(null);
        } else {
          onClose();
        }
      }
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, selectedExpenseCategory]);

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex flex-col items-start gap-1 w-full">
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
      <div className="flex h-[70vh] flex-col overflow-hidden">
        {/* Header with search and tabs */}
        <div className="flex-shrink-0 border-b border-slate-800 p-4">
          <div ref={searchWrapperRef} className="mb-3">
          <Input
            placeholder="Buscar en la ayuda… (atajo: ?)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            rightElement={
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </div>
          <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Secciones de ayuda">
            {([
              { id: "getting-started", label: "🚀 Inicio" },
              { id: "topics", label: "📚 Temas" },
              { id: "shortcuts", label: "⌨️ Atajos" },
              { id: "icons", label: "🎨 Iconos" },
              { id: "expense-categories", label: "🏷️ Categorías" },
              { id: "faq", label: "❓ FAQ" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => { setActiveTab(tab.id as HelpTab); setSelectedExpenseCategory(null); }}
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
          <div className="flex-shrink-0 p-4 border-b border-slate-800 bg-slate-900/30">
            <p className="text-xs text-slate-500 mb-2">{filteredResults.length} resultado(s) para "{search}"</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSearchResultClick(item)}
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
          {/* Getting Started */}
          {activeTab === "getting-started" && !selectedExpenseCategory && (
            <div className="space-y-4">
              {helpCategories.find(c => c.id === "sec-1")?.articles.map((article) => (
                <article key={article.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <h3 className="font-semibold text-slate-100 mb-2">{article.title}</h3>
                  <div className="prose prose-slate max-w-none text-sm text-slate-300 whitespace-pre-line">{article.content}</div>
                  {article.faqs && article.faqs.length > 0 && (
                    <details className="mt-3 border-t border-slate-800 pt-3">
                      <summary className="text-xs font-medium text-slate-400 cursor-pointer">Preguntas frecuentes</summary>
                      <div className="mt-2 space-y-2 text-sm">
                        {article.faqs.map((faq, i) => (
                          <details key={`${article.id}-faq-${i}`} className="rounded-lg bg-slate-800/50 p-2">
                            <summary className="text-slate-200 cursor-pointer">{faq.question}</summary>
                            <p className="mt-1 text-slate-400">{faq.answer}</p>
                          </details>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* Topics - All help categories except sec-1 and sec-8 */}
          {activeTab === "topics" && !selectedExpenseCategory && (
            <div className="space-y-4">
              {helpCategories
                .filter(c => c.id !== "sec-1" && c.id !== "sec-8" && c.articles.length > 0)
                .map((category) => {
                  const isExpanded = expandedCategories.includes(category.id);
                  return (
                    <section key={category.id} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                      >
                        <span className="font-semibold text-slate-100">{category.title}</span>
                        <svg
                          className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-slate-800 p-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            {category.articles.map((article) => (
                              <article key={article.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                <h4 className="font-medium text-slate-100 mb-1">{article.title}</h4>
                                <div className="prose prose-slate max-w-none text-sm text-slate-300 whitespace-pre-line">{article.content}</div>
                                {article.faqs && article.faqs.length > 0 && (
                                  <details className="mt-2 border-t border-slate-800 pt-2">
                                    <summary className="text-xs font-medium text-slate-400 cursor-pointer">FAQ relacionadas</summary>
                                    <div className="mt-1 space-y-1 text-sm">
                                      {article.faqs.map((faq, i) => (
                                        <details key={`${article.id}-faq-${i}`} className="rounded bg-slate-800/50 p-1.5">
                                          <summary className="text-slate-200 cursor-pointer">{faq.question}</summary>
                                          <p className="mt-0.5 text-slate-400">{faq.answer}</p>
                                        </details>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </article>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          )}

          {/* Shortcuts */}
          {activeTab === "shortcuts" && !selectedExpenseCategory && (
            <div className="space-y-2">
              {keyboardShortcuts.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay atajos configurados</p>
              ) : (
                keyboardShortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-400">{shortcut.key}</span>
                    <span className="text-sm text-slate-300 ml-3">{shortcut.description}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Icons */}
          {activeTab === "icons" && !selectedExpenseCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {iconMeanings.length === 0 ? (
                <p className="col-span-full text-slate-500 text-center py-8">No hay iconos documentados</p>
              ) : (
                iconMeanings.map((icon) => (
                  <div key={icon.icon} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{icon.icon}</span>
                      <span className="text-xs text-slate-400">{icon.meaning}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Expense Categories - with clickable detail */}
          {activeTab === "expense-categories" && !selectedExpenseCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {expenseCategories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedExpenseCategory({
                    name: cat.name,
                    color: cat.color,
                    icon: cat.icon,
                    keywords: cat.keywords,
                    articles: getCategoryArticles("sec-3b") // Articles about categories
                  })}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800 transition text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="font-medium text-slate-100">{cat.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 truncate block">{cat.keywords.split(",").slice(0, 3).join(", ")}…</span>
                </button>
              ))}
            </div>
          )}

          {/* Expense Category Detail Modal */}
          {selectedExpenseCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedExpenseCategory(null)}
              role="dialog" aria-modal="true" aria-labelledby="cat-detail-title"
            >
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedExpenseCategory.icon}</span>
                    <div>
                      <h3 id="cat-detail-title" className="font-bold text-slate-100">{selectedExpenseCategory.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedExpenseCategory.color }}></span>
                        <span className="text-xs text-slate-500 capitalize">{selectedExpenseCategory.name.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedExpenseCategory(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <section>
                    <h4 className="font-medium text-slate-300 mb-2">Palabras clave para detección automática</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExpenseCategory.keywords.split(",").map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">{kw.trim()}</span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4 className="font-medium text-slate-300 mb-2">Artículos relacionados</h4>
                    <div className="space-y-2">
                      {selectedExpenseCategory.articles.map((article) => (
                        <details key={article.id} className="rounded-lg border border-slate-800 bg-slate-900/50">
                          <summary className="p-3 font-medium text-slate-100 cursor-pointer">{article.title}</summary>
                          <div className="px-4 pb-3 text-sm text-slate-400 whitespace-pre-line">{article.content}</div>
                        </details>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* FAQ */}
          {activeTab === "faq" && !selectedExpenseCategory && (
            <div className="space-y-2">
              {helpCategories.find(c => c.id === "sec-8")?.articles.map((faqCategory) => (
                <section key={faqCategory.id} className="space-y-2">
                  <h3 className="font-semibold text-slate-100 mb-2 pb-2 border-b border-slate-800">{faqCategory.title}</h3>
                  <div className="space-y-2">
                    {faqCategory.faqs?.map((faq, i) => (
                      <details key={`${faqCategory.id}-${i}`} className="rounded-xl bg-slate-900 border border-slate-800">
                        <summary className="p-3 font-medium text-slate-100 cursor-pointer">{faq.question}</summary>
                        <div className="px-4 pb-3 text-slate-300 text-sm">{faq.answer}</div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Empty states */}
          {(!activeTab || activeTab === "getting-started") && helpCategories.find(c => c.id === "sec-1")?.articles.length === 0 && !selectedExpenseCategory && (
            <p className="text-slate-500 text-center py-8">Contenido de inicio rápido no disponible</p>
          )}
          {activeTab === "topics" && helpCategories.filter(c => c.id !== "sec-1" && c.id !== "sec-8").every(c => c.articles.length === 0) && !selectedExpenseCategory && (
            <p className="text-slate-500 text-center py-8">No hay temas disponibles</p>
          )}
        </div>
      </div>
    </Modal>
  );
}