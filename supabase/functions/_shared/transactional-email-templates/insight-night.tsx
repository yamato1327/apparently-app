import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Row, Column, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'APParently'
const APP_URL = 'https://stay-at-home.lovable.app'
const BRAND = '#0E8F7F'
const BRAND_DARK = '#0A6B5F'
const CORAL = '#F26D5B'
const AMBER = '#F4A93A'
const RED = '#E03A3A'
const INK = '#0E2A2F'
const MUTED = '#5C7378'
const CARD_BG = '#F6FAF9'
const CARD_BORDER = '#D9E5E2'
const PAGE_BG = '#F2F6F5'

interface Tip { emoji?: string; text: string; childName?: string }
interface CalEvent {
  id?: string; emoji?: string; title: string; time?: string | null;
  childName?: string | null; description?: string | null; isCompleted?: boolean
}
interface Reminder { emoji?: string; title: string; childName?: string | null; priority?: string }

interface InsightNightProps {
  parentName?: string
  isCcRecipient?: boolean
  dateLabel?: string
  tomorrowLabel?: string
  reflection?: string
  todayRecap?: Tip[]
  todayCompleted?: number
  todayTotal?: number
  tomorrowHighlight?: string
  packTonight?: Tip[]
  tomorrowMorning?: Tip[]
  bedtimeRitual?: string
  tomorrowEvents?: CalEvent[]
  tomorrowReminders?: Reminder[]
  childGroups?: { childName: string; emoji?: string; events: CalEvent[] }[]
  manageUrl?: string
  unsubscribeUrl?: string
  viewInBrowserUrl?: string
}

const formatTime = (t?: string | null) => {
  if (!t) return 'All day'
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr); const m = Number(mStr || '0')
  if (Number.isNaN(h)) return t
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`
}

const TipList = ({ tips, accent }: { tips: Tip[]; accent: string }) => (
  <Section>
    {tips.map((t, i) => (
      <Section key={i} style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, margin: '6px 0', border: `1px solid ${CARD_BORDER}`, borderLeftWidth: 3, borderLeftColor: accent }}>
        <Text style={{ ...tipText, margin: 0 }}>
          <span style={{ fontSize: 16, marginRight: 6 }}>{t.emoji || '✨'}</span>
          {t.text}
          {t.childName ? <span style={{ color: MUTED, fontSize: 12 }}> · {t.childName}</span> : null}
        </Text>
      </Section>
    ))}
  </Section>
)

const ReminderList = ({ items }: { items: Reminder[] }) => (
  <Section>
    {items.map((r, i) => {
      const isHigh = r.priority === 'high'
      const accent = isHigh ? RED : CORAL
      return (
        <Section key={i} style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, margin: '6px 0', border: `1px solid ${CARD_BORDER}`, borderLeftWidth: 3, borderLeftColor: accent }}>
          <Text style={{ ...tipText, margin: 0, fontWeight: 600 }}>
            <span style={{ fontSize: 16, marginRight: 6 }}>{r.emoji || '📌'}</span>
            {r.title}
            {isHigh ? <span style={{ marginLeft: 6, color: RED, fontSize: 11, fontWeight: 700 }}>HIGH</span> : null}
            {r.childName ? <span style={{ color: MUTED, fontSize: 12, fontWeight: 500 }}> · {r.childName}</span> : null}
          </Text>
        </Section>
      )
    })}
  </Section>
)

const EventRow = ({ e, accent }: { e: CalEvent; accent: string }) => {
  const inner = (
    <Section style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, margin: '6px 0', border: `1px solid ${CARD_BORDER}`, borderLeftWidth: 3, borderLeftColor: accent }}>
      <Row>
        <Column style={{ width: 70, verticalAlign: 'top' }}>
          <Text style={{ margin: 0, color: accent, fontSize: 12, fontWeight: 700 }}>{formatTime(e.time)}</Text>
        </Column>
        <Column style={{ verticalAlign: 'top' }}>
          <Text style={{ ...tipText, margin: 0, fontWeight: 600 }}>
            <span style={{ fontSize: 16, marginRight: 6 }}>{e.emoji || '✨'}</span>
            <span style={{ textDecoration: e.isCompleted ? 'line-through' : 'none', opacity: e.isCompleted ? 0.6 : 1 }}>{e.title}</span>
            {e.isCompleted ? <span style={{ marginLeft: 6 }}>✅</span> : null}
            {e.childName ? <span style={{ color: MUTED, fontSize: 12, fontWeight: 500 }}> · {e.childName}</span> : null}
          </Text>
          {e.description ? <Text style={{ ...tipText, margin: '4px 0 0', fontSize: 12, color: MUTED }}>{e.description}</Text> : null}
        </Column>
      </Row>
    </Section>
  )
  if (e.id) return <Link href={`${APP_URL}/?event=${e.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
  return inner
}

const EventList = ({ events, accent }: { events: CalEvent[]; accent: string }) => {
  if (!events || events.length === 0) {
    return (
      <Section style={{ background: CARD_BG, padding: '12px 14px', borderRadius: 8, margin: '6px 0', border: `1px dashed ${CARD_BORDER}` }}>
        <Text style={{ ...tipText, margin: 0, color: MUTED, fontStyle: 'italic' }}>✨ Nothing scheduled — a quiet one</Text>
      </Section>
    )
  }
  return <Section>{events.map((e, i) => <EventRow key={i} e={e} accent={accent} />)}</Section>
}

const ProgressBar = ({ done, total }: { done: number; total: number }) => {
  if (!total) return null
  const pct = Math.min(100, Math.round((done / total) * 100))
  return (
    <Section style={{ margin: '4px 0 12px' }}>
      <Text style={{ fontSize: 13, color: INK, fontWeight: 600, margin: '0 0 6px' }}>
        ✅ Today {done}/{total} done · {pct}%
      </Text>
      <Section style={{ background: '#E6EEEC', borderRadius: 999, padding: 0, height: 8, overflow: 'hidden' }}>
        <Section style={{ background: BRAND, height: 8, width: `${pct}%`, borderRadius: 999 }} />
      </Section>
    </Section>
  )
}

const InsightNightEmail = ({
  parentName, isCcRecipient, dateLabel, tomorrowLabel, reflection,
  todayRecap = [], todayCompleted = 0, todayTotal = 0,
  tomorrowHighlight, packTonight = [], tomorrowMorning = [], bedtimeRitual,
  tomorrowEvents = [], tomorrowReminders = [], childGroups,
  manageUrl, unsubscribeUrl, viewInBrowserUrl,
}: InsightNightProps) => {
  const greetName = isCcRecipient ? null : parentName
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{tomorrowHighlight || `Tomorrow: ${tomorrowEvents.length} events, ${tomorrowReminders.length} reminders`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {viewInBrowserUrl ? (
            <Text style={topLink}><Link href={viewInBrowserUrl} style={topLinkA}>View in browser</Link></Text>
          ) : null}

          <Section style={brandHeader}>
            <Text style={brandWord}>🏠 {SITE_NAME}</Text>
          </Section>

          <Section style={header}>
            <Text style={kicker}>🌙 Evening reflection · {dateLabel || 'tonight'}</Text>
            <Heading style={h1}>{greetName ? `Evening, ${greetName}` : 'Good evening'}</Heading>
            {reflection ? <Text style={highlight}>{reflection}</Text> : null}
          </Section>

          {todayTotal > 0 ? <ProgressBar done={todayCompleted} total={todayTotal} /> : null}

          {todayRecap.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>📖 Today, in three lines</Text>
              <TipList tips={todayRecap} accent={BRAND} />
            </Section>
          )}

          {tomorrowHighlight ? (
            <Section style={highlightCard}>
              <Text style={kickerWhite}>Tomorrow</Text>
              <Text style={highlightBig}>{tomorrowHighlight}</Text>
            </Section>
          ) : null}

          {tomorrowReminders.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>📌 Pack & remember for tomorrow ({tomorrowReminders.length})</Text>
              <ReminderList items={tomorrowReminders} />
            </Section>
          )}

          {childGroups && childGroups.length > 1 ? (
            childGroups.map((g, i) => (
              <Section key={i} style={card}>
                <Text style={sectionTitle}>{g.emoji || '👶'} {g.childName}'s tomorrow</Text>
                <EventList events={g.events} accent={AMBER} />
              </Section>
            ))
          ) : (
            <Section style={card}>
              <Text style={sectionTitle}>📅 Tomorrow's schedule {tomorrowLabel ? `· ${tomorrowLabel}` : ''}</Text>
              <EventList events={tomorrowEvents} accent={AMBER} />
            </Section>
          )}

          {packTonight.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>🎒 Pack tonight</Text>
              <TipList tips={packTonight} accent={CORAL} />
            </Section>
          )}

          {tomorrowMorning.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>☀️ Tomorrow morning</Text>
              <TipList tips={tomorrowMorning} accent={AMBER} />
            </Section>
          )}

          {bedtimeRitual ? (
            <Section style={mindset}>
              <Text style={{ ...tipText, fontStyle: 'italic', color: INK, margin: 0 }}>💛 {bedtimeRitual}</Text>
            </Section>
          ) : null}

          <Section style={ctaWrap}>
            <Link href={APP_URL} style={ctaButton}>Open {SITE_NAME} →</Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Sent with care by 🏠 {SITE_NAME}
            {isCcRecipient && parentName ? <> · forwarded to you as {parentName}'s co-parent</> : null}
            <br />
            {manageUrl ? <Link href={manageUrl} style={footerLink}>Manage email times</Link> : null}
            {manageUrl && unsubscribeUrl ? <span style={{ color: MUTED }}> · </span> : null}
            {unsubscribeUrl ? <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InsightNightEmail,
  subject: (data: Record<string, any>) => {
    const ev = (data?.tomorrowEvents?.length || 0)
    const rem = (data?.tomorrowReminders?.length || 0)
    if (rem > 0 && ev > 0) return `🌙 Tomorrow: ${ev} event${ev>1?'s':''} + ${rem} reminder${rem>1?'s':''}`
    if (rem > 0) return `🌙 Tomorrow: ${rem} reminder${rem>1?'s':''} to pack`
    if (ev > 0) return `🌙 Tomorrow: ${ev} thing${ev>1?'s':''} on`
    return `🌙 Tonight's prep`
  },
  displayName: 'Evening insight reflection',
  previewData: {
    parentName: 'Sam',
    dateLabel: 'Wed 23 Apr',
    tomorrowLabel: 'Thu 24 Apr',
    reflection: "What's one small win from today you can name out loud?",
    todayRecap: [
      { emoji: '🏆', text: 'Mia smashed the swim carnival', childName: 'Mia' },
      { emoji: '📚', text: 'Leo finished his reader without a fight', childName: 'Leo' },
    ],
    todayCompleted: 6,
    todayTotal: 8,
    tomorrowHighlight: 'Library day for Leo + early pickup at 2:30pm',
    tomorrowReminders: [{ emoji: '📚', title: 'Library books in front pocket', childName: 'Leo', priority: 'high' }],
    packTonight: [{ emoji: '📚', text: 'Library books in the front pocket', childName: 'Leo' }],
    tomorrowMorning: [{ emoji: '⏰', text: 'Set alarm 10 min earlier — early pickup' }],
    bedtimeRitual: 'Three things you noticed today. Then lights out.',
    tomorrowEvents: [
      { emoji: '📚', title: 'Library day', time: '09:00', childName: 'Leo' },
      { emoji: '🥋', title: 'Karate', time: '17:00', childName: 'Mia' },
    ],
    manageUrl: `${APP_URL}/profile`,
    viewInBrowserUrl: APP_URL,
  },
} satisfies TemplateEntry

const main = { backgroundColor: PAGE_BG, fontFamily: '"Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif', color: INK, margin: 0, padding: 0 }
const container = { padding: '20px 16px 32px', maxWidth: 600, margin: '0 auto' }
const topLink = { fontSize: 11, color: MUTED, textAlign: 'right' as const, margin: '0 0 8px' }
const topLinkA = { color: MUTED, textDecoration: 'underline' }
const brandHeader = { padding: '4px 0 8px' }
const brandWord = { fontSize: 14, fontWeight: 700, color: BRAND_DARK, margin: 0, letterSpacing: 0.2 }
const header = { padding: '4px 0 8px' }
const kicker = { fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.4, margin: '0 0 6px', textTransform: 'uppercase' as const }
const kickerWhite = { fontSize: 12, color: '#ffffff', fontWeight: 600, letterSpacing: 0.4, margin: '0 0 6px', textTransform: 'uppercase' as const, opacity: 0.9 }
const h1 = { fontSize: 26, fontWeight: 800, color: INK, margin: '0 0 8px', lineHeight: 1.2 }
const highlight = { fontSize: 15, color: BRAND, fontWeight: 600, margin: '6px 0 0' }
const card = { background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: '14px 16px', margin: '14px 0' }
const highlightCard = { background: BRAND, borderRadius: 12, padding: '16px', margin: '14px 0' }
const highlightBig = { fontSize: 18, color: '#ffffff', fontWeight: 700, margin: 0, lineHeight: 1.3 }
const sectionTitle = { fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 8px' }
const tipText = { fontSize: 14, color: INK, lineHeight: 1.45 }
const mindset = { background: '#FFF6E8', borderRadius: 12, padding: '14px 16px', margin: '14px 0', border: `1px solid #F2E0BE` }
const ctaWrap = { textAlign: 'center' as const, padding: '8px 0 4px' }
const ctaButton = { background: BRAND, color: '#ffffff', textDecoration: 'none', padding: '12px 22px', borderRadius: 999, fontWeight: 700, fontSize: 14, display: 'inline-block' }
const hr = { borderColor: CARD_BORDER, margin: '24px 0 12px' }
const footer = { fontSize: 11, color: MUTED, lineHeight: 1.6, textAlign: 'center' as const }
const footerLink = { color: BRAND_DARK, textDecoration: 'underline' }
