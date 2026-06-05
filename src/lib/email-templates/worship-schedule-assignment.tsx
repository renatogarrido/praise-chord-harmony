import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  scheduleTitle?: string
  serviceDate?: string
  roleLabel?: string
  setlistName?: string
  notes?: string
  scheduleUrl?: string
  siteName?: string
}

const Email = ({
  recipientName = 'Olá',
  scheduleTitle = 'Culto',
  serviceDate = '',
  roleLabel = '',
  setlistName,
  notes,
  scheduleUrl = '#',
  siteName = 'Cifras Praise',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi escalado para {scheduleTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você está na escala 🎶</Heading>
        <Text style={text}>Olá {recipientName},</Text>
        <Text style={text}>
          Você foi escalado(a) para servir em <strong>{scheduleTitle}</strong>.
        </Text>

        <Section style={card}>
          <Text style={cardRow}><strong>Data:</strong> {serviceDate}</Text>
          <Text style={cardRow}><strong>Função:</strong> {roleLabel}</Text>
          {setlistName ? <Text style={cardRow}><strong>Repertório:</strong> {setlistName}</Text> : null}
          {notes ? <Text style={cardRow}><strong>Observações:</strong> {notes}</Text> : null}
        </Section>

        <Button style={button} href={scheduleUrl}>Ver escala</Button>

        <Text style={footer}>Que Deus abençoe seu ministério. — {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Você foi escalado para ${data?.scheduleTitle ?? 'um culto'}`,
  displayName: 'Escala do Louvor — Notificação',
  previewData: {
    recipientName: 'João',
    scheduleTitle: 'Culto de Domingo',
    serviceDate: 'Domingo, 14/06/2026 às 19h',
    roleLabel: 'Violão',
    setlistName: 'Adoração Domingo',
    notes: 'Chegar 1h antes para passagem de som.',
    scheduleUrl: 'https://cifraspraise.com.br/app/scale',
    siteName: 'Cifras Praise',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.55', margin: '0 0 14px' }
const card = {
  backgroundColor: '#faf6ec',
  border: '1px solid #e8dcb5',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '16px 0 22px',
}
const cardRow = { fontSize: '14px', color: '#3a3a3a', margin: '4px 0', lineHeight: '1.5' }
const button = {
  backgroundColor: '#C5A059',
  color: '#121212',
  fontSize: '13px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  borderRadius: '999px',
  padding: '12px 22px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
