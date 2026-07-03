import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

export interface LetterPDFParams {
  letterContent: string;
  certified?: boolean;
  clientName?: string;
  clientAddress?: string;
  bureauName?: string;
  bureauAddress?: string;
  date?: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 64,
    paddingHorizontal: 64,
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#111827",
  },
  certified: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 18,
    textDecoration: "underline",
  },
  line: {
    marginBottom: 2,
  },
  spacer: {
    height: 8,
  },
});

/** Renders the AI-generated letter body, preserving its line breaks. */
function LetterBody({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <View key={i} style={styles.spacer} />
        ) : (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        )
      )}
    </>
  );
}

function LettersDocument({ letters }: { letters: LetterPDFParams[] }) {
  return (
    <Document>
      {letters.map((letter, idx) => (
        <Page key={idx} size="LETTER" style={styles.page} wrap>
          {letter.certified !== false && (
            <Text style={styles.certified}>
              CERTIFIED MAIL — RETURN RECEIPT REQUESTED
            </Text>
          )}
          <LetterBody content={letter.letterContent} />
        </Page>
      ))}
    </Document>
  );
}

/** Generates a single-letter PDF. */
export async function generateLetterPDF(
  params: LetterPDFParams
): Promise<Buffer> {
  return renderToBuffer(<LettersDocument letters={[params]} />);
}

/** Generates a combined PDF with one page per letter. */
export async function generateRoundPDF(
  letters: LetterPDFParams[]
): Promise<Buffer> {
  return renderToBuffer(<LettersDocument letters={letters} />);
}
