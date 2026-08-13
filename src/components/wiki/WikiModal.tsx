import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { WIKI_PAGES, WIKI_CONTENT } from '../../data/wiki';

interface WikiModalProps {
  onClose: () => void;
}

export function WikiModal({ onClose }: WikiModalProps) {
  const [activeSlug, setActiveSlug] = useState(WIKI_PAGES[0].slug);
  const [mobileShowContent, setMobileShowContent] = useState(false);

  const activePage = WIKI_PAGES.find((p) => p.slug === activeSlug) ?? WIKI_PAGES[0];

  return (
    <Modal title="Wiki — Pantheon Idle" icon="book-open" onClose={onClose}>
      <div className="flex h-full min-h-0">
        <nav
          className={`
            w-full shrink-0 overflow-y-auto border-r border-void-600 bg-void-800/40 sm:block sm:w-60
            ${mobileShowContent ? 'hidden' : 'block'}
          `}
        >
          {WIKI_PAGES.map((page) => (
            <button
              key={page.slug}
              onClick={() => {
                setActiveSlug(page.slug);
                setMobileShowContent(true);
              }}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-void-700/60 px-4 py-3 text-left transition ${
                page.slug === activeSlug ? 'bg-code-500/10' : 'hover:bg-void-700/40'
              }`}
            >
              <span
                className={`font-display text-xs font-bold uppercase tracking-wide ${
                  page.slug === activeSlug ? 'text-code-300' : 'text-white/80'
                }`}
              >
                {page.title}
              </span>
              <span className="text-[11px] leading-snug text-white/40">{page.summary}</span>
            </button>
          ))}
        </nav>

        <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:block sm:px-6 sm:py-5 ${mobileShowContent ? 'block' : 'hidden'}`}>
          <button
            onClick={() => setMobileShowContent(false)}
            className="mb-3 flex items-center gap-1 text-xs text-white/50 sm:hidden"
          >
            <Icon name="chevron-left" size={14} />
            Voltar ao índice
          </button>
          <div className="wiki-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{WIKI_CONTENT[activePage.slug]}</ReactMarkdown>
          </div>
        </div>
      </div>
    </Modal>
  );
}
