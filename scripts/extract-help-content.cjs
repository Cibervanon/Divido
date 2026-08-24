const fs = require('fs');
const path = require('path');

const manualPath = path.join(__dirname, '..', 'docs', 'manual-usuario-divido.html');
const outputPath = path.join(__dirname, '..', 'apps', 'web', 'src', 'data', 'helpContent.ts');

const html = fs.readFileSync(manualPath, 'utf-8');

function extractContent(html) {
  const sections = [];
  const sectionRegex = /<section id="sec-(\d+(?:[a-z]?))" class="section">([\s\S]*?)<\/section>/g;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    const sectionId = match[1];
    const sectionHtml = match[2];

    const titleMatch = sectionHtml.match(/<h2 class="sec-title">([\s\S]*?)<\/h2>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `Sección ${sectionId}`;

    const introMatch = sectionHtml.match(/<h2 class="sec-title">[\s\S]*?<\/h2>([\s\S]*?)(?=<h3|<div class="cols"|<table|<div class="callout"|<\/section>|$)/);
    const intro = introMatch ? cleanHtml(introMatch[1]).trim() : '';

    const subsections = [];
    const subsectionRegex = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<div class="cols"|<table|<div class="callout"|<div class="mockup"|<\/section>|$)/g;
    let subMatch;

    while ((subMatch = subsectionRegex.exec(sectionHtml)) !== null) {
      const subTitle = subMatch[1].replace(/<[^>]*>/g, '').trim();
      const subHtml = subMatch[2];
      const content = cleanHtml(subHtml).trim();

      if (content) {
        subsections.push({
          id: slugify(subTitle),
          title: subTitle,
          content: content,
          faqs: []
        });
      }
    }

    const faqRegex = /<div class="faq">([\s\S]*?)<\/div>/g;
    let faqMatch;
    const faqs = [];

    while ((faqMatch = faqRegex.exec(sectionHtml)) !== null) {
      const faqHtml = faqMatch[1];
      const qMatch = faqMatch[0].match(/<span class="q-tx">([\s\S]*?)<\/span>/);
      const aMatch = faqMatch[0].match(/<div class="faq-a">([\s\S]*?)<\/div>/);

      if (qMatch && aMatch) {
        faqs.push({
          question: qMatch[1].replace(/<[^>]*>/g, '').trim(),
          answer: cleanHtml(aMatch[1]).trim()
        });
      }
    }

    if (faqs.length > 0) {
      subsections.push({
        id: 'faq',
        title: 'Preguntas Frecuentes',
        content: '',
        faqs: faqs
      });
    }

    sections.push({
      id: `sec-${sectionId}`,
      title: title,
      intro: intro,
      subsections: subsections
    });
  }

  return sections;
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div class="mockup"[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="cols"[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="mockup"[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="stepper"[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="flow-pipe"[\s\S]*?<\/div>/gi, '')
    .replace(/<div class="card"[\s\S]*?<\/div>/gi, '')
    .replace(/<table class="data"[\s\S]*?<\/table>/g, (match) => {
      return match
        .replace(/<thead>[\s\S]*?<\/thead>/gi, '')
        .replace(/<tbody>[\s\S]*?<\/tbody>/gi, '')
        .replace(/<tr>/gi, '\n')
        .replace(/<\/tr>/gi, '')
        .replace(/<td[^>]*>/gi, ' | ')
        .replace(/<\/td>/gi, '')
        .replace(/<th[^>]*>/gi, ' **')
        .replace(/<\/th>/gi, '** |')
        .replace(/<[^>]*>/g, '')
        .replace(/\n\s*\n/g, '\n');
    })
    .replace(/<details[\s\S]*?<\/details>/g, (match) => {
      const summaryMatch = match.match(/<summary>([\s\S]*?)<\/summary>/);
      const summary = summaryMatch ? summaryMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const content = match.replace(/<summary>[\s\S]*?<\/summary>/, '').replace(/<[^>]*>/g, '').trim();
      return summary ? `**${summary}:** ${content}` : content;
    })
    .replace(/<div class="callout (\w+)">[\s\S]*?<\/div>/g, (match) => {
      const typeMatch = match.match(/callout (\w+)/);
      const type = typeMatch ? typeMatch[1] : 'info';
      const labelMatch = match.match(/<span class="callout-label">([\s\S]*?)<\/span>/);
      const label = labelMatch ? labelMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const content = match.replace(/<div class="callout \w+">[\s\S]*?<span class="callout-label">[\s\S]*?<\/span>/, '').replace(/<\/div>/, '').replace(/<[^>]*>/g, '').trim();
      const prefix = type === 'warn' ? '⚠️ ' : type === 'tip' ? '💡 ' : type === 'info' ? 'ℹ️ ' : '';
      return `> **${label}** ${content}`;
    })
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractShortcuts(html) {
  const shortcuts = [];
  const shortcutSection = html.match(/<h3>Atajos de teclado<\/h3>([\s\S]*?)(?=<h3|<\/section>)/);
  if (shortcutSection) {
    const rows = shortcutSection[1].match(/<div class="prow">([\s\S]*?)<\/div>/g);
    if (rows) {
      rows.forEach(row => {
        const keyMatch = row.match(/<span class="p-left"><b>([^<]+)<\/b>/);
        const descMatch = row.match(/<span class="small muted">([^<]+)<\/span>/);
        if (keyMatch && descMatch) {
          shortcuts.push({
            key: keyMatch[1].trim(),
            description: descMatch[1].trim()
          });
        }
      });
    }
    return shortcuts;
  }
  return [];
}

function extractIconsTable(html) {
  const icons = [];
  const iconSection = html.match(/<h3>Iconos de la interfaz<\/h3>([\s\S]*?)(?=<h3|<\/section>)/);
  if (iconSection) {
    const rows = iconSection[1].match(/<tr>([\s\S]*?)<\/tr>/g);
    if (rows) {
      rows.slice(1).forEach(row => {
        const cells = row.match(/<td>([\s\S]*?)<\/td>/g);
        if (cells && cells.length >= 2) {
          const icon = cells[0].replace(/<[^>]*>/g, '').trim();
          const meaning = cells[1].replace(/<[^>]*>/g, '').trim();
          icons.push({ icon, meaning });
        }
      });
    }
    return icons;
  }
  return [];
}

function extractCategories(html) {
  const categories = [];
  const catSection = html.match(/<h3>Categorías de gastos<\/h3>([\s\S]*?)(?=<h3|<\/section>)/);
  if (catSection) {
    const cells = catSection[1].match(/<div class="cell">[\s\S]*?<\/div>/g);
    if (cells) {
      cells.forEach(cell => {
        const nameMatch = cell.match(/<span class="col-name">([^<]+)<\/span>/);
        const colorMatch = cell.match(/<span class="badge (\w+)">#([^<]+)<\/span>/);
        const iconMatch = cell.match(/<code>([^<]+)<\/code>/);
        const wordsMatch = cell.match(/<li>Palabras: ([^<]+)<\/li>/);

        if (nameMatch) {
          categories.push({
            name: nameMatch[1].trim(),
            color: colorMatch ? colorMatch[2] : '',
            icon: iconMatch ? iconMatch[1] : '',
            keywords: wordsMatch ? wordsMatch[1].trim() : ''
          });
        }
      });
    }
    return categories;
  }
  return [];
}

const sections = extractContent(html);
const shortcuts = extractShortcuts(html);
const icons = extractIconsTable(html);
const categories = extractCategories(html);

// Build output as string
let output = `// Auto-generated from manual-usuario-divido.html
// DO NOT EDIT MANUALLY - Run scripts/extract-help-content.js to regenerate

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  articles: HelpArticle[];
}

export interface KeyboardShortcut {
  key: string;
  description: string;
}

export interface IconMeaning {
  icon: string;
  meaning: string;
}

export interface ExpenseCategory {
  name: string;
  color: string;
  icon: string;
  keywords: string;
}

`;

output += `export const helpCategories: HelpCategory[] = ${JSON.stringify(sections.map(s => ({
  id: s.id,
  title: s.title,
  articles: s.subsections.map(sub => ({
    id: sub.id,
    title: sub.title,
    content: sub.content,
    category: s.id,
    faqs: sub.faqs || []
  }))
})), null, 2)};\n\n`;

output += `export const keyboardShortcuts: KeyboardShortcut[] = ${JSON.stringify(shortcuts, null, 2)};\n\n`;

output += `export const iconMeanings: IconMeaning[] = ${JSON.stringify(icons, null, 2)};\n\n`;

output += `export const expenseCategories: ExpenseCategory[] = ${JSON.stringify(categories, null, 2)};\n\n`;

output += `export const helpSearchIndex = ${JSON.stringify(
  sections.flatMap(s => 
    s.subsections.map(sub => ({
      id: sub.id,
      title: sub.title,
      category: s.title,
      categoryId: s.id,
      content: sub.content.substring(0, 200)
    }))
  ).concat(
    Array.from({ length: 15 }, (_, i) => ({ // FAQs from all sections
      id: `faq-${i}`,
      title: `Pregunta ${i + 1}`,
      category: 'Preguntas Frecuentes',
      categoryId: 'faq',
      content: ''
    }))
  ), null, 2)};\n`;

fs.writeFileSync(outputPath, output);

console.log('Generated:', outputPath);
console.log('Sections:', sections.length);
console.log('Shortcuts:', shortcuts.length);
console.log('Icons:', icons.length);
console.log('Categories:', categories.length);