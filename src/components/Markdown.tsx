import type { ReactNode } from 'react';
import { Linking, Text as RNText, View } from 'react-native';

import { fontFamily, type TypeVariant } from '@/design/tokens';
import { makeStyles } from '@/design/theme';

import { Card } from './Card';
import { Text } from './Text';

/**
 * Kleiner Markdown-Renderer für die Rechtstexte aus docs/legal (eine Quelle für Webseite und App).
 * Kann genau das, was dort vorkommt: Überschriften, Absätze, Listen (auch eingerückt), Zitate,
 * Tabellen, **fett**, [Links](https://…) und markierte [PLATZHALTER: …]. Kein HTML.
 */
export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'item'; text: string; depth: number; marker: string }
  | { kind: 'table'; header: string[]; rows: string[][] };

const LIST = /^(\s*)([-*]|\d+\.) +(.*)$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || /^-{3,}$/.test(line.trim())) {
      i++;
      continue;
    }
    const heading = /^(#{1,4}) +(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>'))
        parts.push(lines[i++]!.replace(/^> ?/, ''));
      blocks.push({ kind: 'quote', text: parts.join(' ').trim() });
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(cells(lines[i++]!));
      const [header = [], ...rest] = rows;
      blocks.push({
        kind: 'table',
        header,
        rows: rest.filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c))),
      });
      continue;
    }
    const item = LIST.exec(line);
    if (item) {
      let text = item[3]!;
      i++;
      // Fortsetzungszeilen (eingerückt oder ohne neues Listenzeichen) gehören zum Punkt
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        !LIST.test(lines[i]!) &&
        !/^(#|>|\|)/.test(lines[i]!.trim())
      )
        text += ` ${lines[i++]!.trim()}`;
      blocks.push({
        kind: 'item',
        text,
        depth: item[1]!.length >= 2 ? 1 : 0,
        marker: /\d/.test(item[2]!) ? item[2]! : '•',
      });
      continue;
    }
    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !LIST.test(lines[i]!) &&
      !/^(#{1,4} |>|\|)/.test(lines[i]!.trim())
    )
      parts.push(lines[i++]!.trim());
    blocks.push({ kind: 'paragraph', text: parts.join(' ') });
  }
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|\[PLATZHALTER:[^\]]*\]|\[[^\]]+\]\([^)\s]+\)|`[^`]+`)/g;
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

function Inline({ text, bold }: { text: string; bold?: boolean }) {
  const styles = useStyles();
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${match.index}`;
    if (token.startsWith('**')) {
      nodes.push(
        <RNText key={key} style={styles.bold}>
          <Inline text={token.slice(2, -2)} bold />
        </RNText>,
      );
    } else if (token.startsWith('[PLATZHALTER:')) {
      nodes.push(
        <RNText key={key} style={styles.mark}>
          {token}
        </RNText>,
      );
    } else if (token.startsWith('[')) {
      const [, label = '', url = ''] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token) ?? [];
      nodes.push(
        SAFE_LINK.test(url) ? (
          <RNText
            key={key}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(url)}
          >
            {label}
          </RNText>
        ) : (
          label
        ),
      );
    } else {
      nodes.push(token.slice(1, -1));
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <RNText style={bold ? styles.bold : undefined}>{nodes}</RNText>;
}

const HEADING_VARIANT: Record<number, TypeVariant> = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'bodyStrong' };

export function Markdown({ source, testID }: { source: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.root} testID={testID}>
      {parseMarkdown(source).map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={index}
                variant={HEADING_VARIANT[block.level]}
                heading
                style={index > 0 && block.level <= 2 ? styles.sectionTop : undefined}
              >
                {block.text}
              </Text>
            );
          case 'quote':
            return (
              <Card key={index} tone="accent">
                <Text variant="small">
                  <Inline text={block.text} />
                </Text>
              </Card>
            );
          case 'item':
            return (
              <View key={index} style={[styles.item, block.depth ? styles.nested : null]}>
                <Text variant="body" style={styles.marker} importantForAccessibility="no">
                  {block.marker}
                </Text>
                <Text variant="body" style={styles.flex}>
                  <Inline text={block.text} />
                </Text>
              </View>
            );
          case 'table':
            // Auf dem Handy als Karten: je Zeile „Spalte: Wert“
            return (
              <View key={index} style={styles.table}>
                {block.rows.map((row, r) => (
                  <Card key={r} tone="muted" style={styles.row}>
                    {row.map((cell, c) =>
                      cell ? (
                        <Text key={c} variant={c === 0 ? 'bodyStrong' : 'small'}>
                          {c > 0 && block.header[c] ? (
                            <RNText style={styles.bold}>{`${block.header[c]}: `}</RNText>
                          ) : null}
                          <Inline text={cell} />
                        </Text>
                      ) : null,
                    )}
                  </Card>
                ))}
              </View>
            );
          default:
            return (
              <Text key={index} variant="body">
                <Inline text={block.text} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { gap: t.space.sm },
  sectionTop: { marginTop: t.space.md },
  bold: { fontFamily: fontFamily.bodyMedium },
  link: { color: t.colors.primary, textDecorationLine: 'underline' },
  mark: { backgroundColor: t.colors.accentSoft },
  item: { flexDirection: 'row', gap: t.space.xs, paddingRight: t.space.xs },
  nested: { paddingLeft: t.space.lg },
  marker: { minWidth: 18 },
  flex: { flex: 1 },
  table: { gap: t.space.xs },
  row: { gap: t.space.xxs },
}));
