'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'

type Lead = {
  id?: number
  created_at?: string
  name: string
  address: string
  postcode: string
  phone: string
  email: string
  monthly_bill: number
  annual_usage: number
  roof_type: string
  stage: string
  notes: string
}

type LeadFile = {
  id?: number
  lead_id: number
  file_name: string
  file_type: string
  file_path: string
  created_at?: string
}

type Proposal = {
  id?: number
  lead_id?: number
  title: string
  system_size_kw: number
  panel_count: number
  battery_kwh: number
  annual_generation: number
  annual_saving: number
  payback_years: string
  proposal_status: string
  created_at?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

const emptyLead: Lead = {
  name: '',
  address: '',
  postcode: '',
  phone: '',
  email: '',
  monthly_bill: 180,
  annual_usage: 4800,
  roof_type: 'South-facing',
  stage: 'New Lead',
  notes: ''
}

function calcLead(lead: Lead) {
  const annualBill = Number(lead.monthly_bill || 0) * 12
  const usage = Number(lead.annual_usage || 0)
  const systemKw = Math.max(3.52, usage ? usage / 900 : 6)
  const panelCount = Math.ceil((systemKw * 1000) / 440)
  const trueKw = (panelCount * 440) / 1000
  const batteryKwh = usage > 5000 ? 10 : 5
  const annualGeneration = Math.round(trueKw * 900)
  const annualSaving = Math.round(annualBill * 0.78)
  const billReduction = annualBill ? Math.round((annualSaving / annualBill) * 100) : 0
  const price = Math.round(2500 + panelCount * 430 + batteryKwh * 650)
  const payback = annualSaving ? (price / annualSaving).toFixed(1) : '—'
  return { annualBill, systemKw: trueKw, panelCount, batteryKwh, annualGeneration, annualSaving, billReduction, price, payback }
}

function money(n: number) {
  return `£${Number(n || 0).toLocaleString()}`
}

export default function Home() {
  const [view, setView] = useState('Dashboard')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadFiles, setLeadFiles] = useState<LeadFile[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [proposalLead, setProposalLead] = useState<Lead | null>(null)
  const [proposalFiles, setProposalFiles] = useState<LeadFile[]>([])
  const [leadModal, setLeadModal] = useState(false)
  const [profileModal, setProfileModal] = useState(false)
  const [proposalModal, setProposalModal] = useState(false)
  const [form, setForm] = useState<Lead>(emptyLead)
  const [status, setStatus] = useState('Loading...')
  const [fileStatus, setFileStatus] = useState('')
  const [commercialMode, setCommercialMode] = useState<'Existing Building' | 'New Build'>('New Build')
  const [roofArea, setRoofArea] = useState(1200)
  const [commercialPanels, setCommercialPanels] = useState(520)
  const [panelWatts, setPanelWatts] = useState(440)
  const [batteryKwh, setBatteryKwh] = useState(100)
  const [electricityRate, setElectricityRate] = useState(0.27)

  useEffect(() => { loadLeads(); loadProposals() }, [])

  async function loadLeads() {
    if (!supabase) { setStatus('Supabase env vars missing'); return }
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) { setStatus('Could not read leads table'); return }
    setLeads(data || [])
    setStatus('Connected to Supabase')
  }

  async function loadProposals() {
    if (!supabase) return
    const { data } = await supabase.from('proposals').select('*').order('created_at', { ascending: false })
    if (data) setProposals(data)
  }

  async function loadLeadFiles(leadId: number) {
    if (!supabase) return
    const { data, error } = await supabase.from('lead_files').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    if (error) {
      setFileStatus('File table not ready yet. Run the V7 SQL file.')
      setLeadFiles([])
      return
    }
    setLeadFiles(data || [])
    setFileStatus('')
  }

  async function openProfile(lead: Lead) {
    setSelectedLead(lead)
    setProfileModal(true)
    if (lead.id) await loadLeadFiles(lead.id)
  }

  function updateForm(field: keyof Lead, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const payload = { ...form, monthly_bill: Number(form.monthly_bill), annual_usage: Number(form.annual_usage) }
    const { data, error } = await supabase.from('leads').insert([payload]).select().single()
    if (!error && data) {
      setLeads([data, ...leads])
      setStatus('Lead saved to Supabase')
    } else {
      setStatus('Lead save failed')
    }
    setLeadModal(false)
    setForm(emptyLead)
  }

  async function uploadLeadFile(fileType: string, file?: File | null) {
    if (!file || !selectedLead?.id || !supabase) return
    setFileStatus('Uploading...')
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${selectedLead.id}/${fileType}/${Date.now()}-${safeName}`

    const up = await supabase.storage.from('lead-files').upload(path, file, { upsert: false })
    if (up.error) { setFileStatus('Upload failed. Create a public Supabase Storage bucket called lead-files.'); return }

    const record = { lead_id: selectedLead.id, file_name: file.name, file_type: fileType, file_path: path }
    const ins = await supabase.from('lead_files').insert([record]).select().single()
    if (ins.error) { setFileStatus('File uploaded but lead_files table is missing. Run V7 SQL.'); return }

    setLeadFiles([ins.data, ...leadFiles])
    setFileStatus('File uploaded successfully')
  }

  function getFileUrl(path: string) {
    if (!supabase) return '#'
    return supabase.storage.from('lead-files').getPublicUrl(path).data.publicUrl
  }

  async function generateProposal(lead: Lead) {
    if (!supabase || !lead.id) return
    const c = calcLead(lead)
    const payload: Proposal = {
      lead_id: lead.id,
      title: `${lead.name} Solar Proposal`,
      system_size_kw: Number(c.systemKw.toFixed(2)),
      panel_count: c.panelCount,
      battery_kwh: c.batteryKwh,
      annual_generation: c.annualGeneration,
      annual_saving: c.annualSaving,
      payback_years: c.payback,
      proposal_status: 'Draft'
    }
    const { data, error } = await supabase.from('proposals').insert([payload]).select().single()
    if (!error && data) {
      setProposals([data, ...proposals])
      setFileStatus('Proposal generated and saved')
    } else {
      setFileStatus('Proposal table not ready. Run V7 SQL.')
    }
  }

  async function openProposal(proposal: Proposal) {
    setSelectedProposal(proposal)
    const lead = leads.find(l => l.id === proposal.lead_id) || null
    setProposalLead(lead)
    setProposalFiles([])

    if (supabase && proposal.lead_id) {
      const { data: freshLead } = await supabase.from('leads').select('*').eq('id', proposal.lead_id).single()
      if (freshLead) setProposalLead(freshLead)

      const { data: files } = await supabase.from('lead_files').select('*').eq('lead_id', proposal.lead_id).order('created_at', { ascending: false })
      if (files) setProposalFiles(files)
    }

    setProposalModal(true)
  }

  async function downloadProposalPdf(proposal: Proposal, lead: Lead | null, files: LeadFile[]) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const loadImageAsBase64 = async (url: string): Promise<string | null> => {

  try {

    const response = await fetch(url)

    const blob = await response.blob()

    return await new Promise((resolve) => {

      const reader = new FileReader()

      reader.onloadend = () => resolve(reader.result as string)

      reader.onerror = () => resolve(null)

      reader.readAsDataURL(blob)

    })

  } catch {

    return null

  }

}

const mgenLogo = await loadImageAsBase64('/mgen-logo.png')

    const pageW = 210
    const pageH = 297
    const green: [number,number,number] = [31,143,70]
    const dark: [number,number,number] = [7,16,20]

    const annualSaving = Number(proposal.annual_saving || 0)
    const generation = Number(proposal.annual_generation || 0)
    const co2 = Math.round(generation * 0.207 / 1000 * 10) / 10
    const ref = `MGEN-${new Date().getFullYear()}-${String(proposal.id || 1).padStart(4,'0')}`
    const date = proposal.created_at ? new Date(proposal.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')

    function footer(page: number) {
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text('MGEN Renewables · Powering smarter energy', 14, 286)
      doc.text(`Page ${page}`, 186, 286)
    }

    // Page 1
    doc.setFillColor(...dark); doc.rect(0,0,pageW,95,'F')
    doc.setFillColor(...green); doc.rect(0,95,pageW,18,'F')
    if (mgenLogo) {

  doc.setFillColor(255, 255, 255)

  doc.roundedRect(14, 14, 28, 28, 4, 4, 'F')

  doc.addImage(mgenLogo, 'PNG', 17, 17, 22, 22)

}

    doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(28)
    doc.text('Solar PV & Battery Proposal', 50, 28)
    doc.setFontSize(13); doc.setFont('helvetica','normal')
    doc.text(`Prepared for ${lead?.name || 'Customer'}`, 50, 40)
    doc.setFontSize(11)
    doc.text(`Reference: ${ref}`, 14, 55)
    doc.text(`Date: ${date}`, 14, 62)
    doc.text(`Status: ${proposal.proposal_status || 'Draft'}`, 14, 69)
    doc.setFontSize(10); doc.text('MCS Certified | NAPIT Registered | Blue Drop Warranty Protected', 14, 104)

    doc.setTextColor(20); doc.setFont('helvetica','bold'); doc.setFontSize(16)
    doc.text('Customer Details', 14, 128)
    doc.setFont('helvetica','normal'); doc.setFontSize(11)
    doc.text(`Name: ${lead?.name || '—'}`, 14, 140)
    doc.text(`Address: ${lead?.address || '—'}`, 14, 148)
    doc.text(`Postcode: ${lead?.postcode || '—'}`, 14, 156)
    doc.text(`Phone: ${lead?.phone || '—'}`, 14, 164)
    doc.text(`Email: ${lead?.email || '—'}`, 14, 172)

    doc.setFillColor(245,248,245); doc.roundedRect(14,190,182,56,4,4,'F')
    doc.setTextColor(...green); doc.setFont('helvetica','bold'); doc.setFontSize(20)
    doc.text(`${money(annualSaving)} annual saving`, 24, 210)
    doc.setTextColor(20); doc.setFontSize(13)
    doc.text(`${money(annualSaving * 10)} estimated 10 year saving`, 24, 225)
    doc.text(`${money(annualSaving * 25)} estimated 25 year saving`, 24, 236)
    footer(1)

    // Page 2
    doc.addPage()
    doc.setTextColor(20); doc.setFont('helvetica','bold'); doc.setFontSize(20)
    doc.text('Recommended System', 14, 22)
    doc.setFontSize(12); doc.setFont('helvetica','normal')
    doc.text(`System size: ${proposal.system_size_kw}kW`, 14, 40)
    doc.text(`Panels: ${proposal.panel_count} high efficiency solar panels`, 14, 50)
    doc.text(`Battery: ${proposal.battery_kwh}kWh battery storage`, 14, 60)
    doc.text(`Annual generation: ${generation.toLocaleString()} kWh`, 14, 70)
    doc.text(`Payback: ${proposal.payback_years} years`, 14, 80)
    doc.text(`CO2 reduction: ${co2} tonnes per year`, 14, 90)

    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Scope of Works', 14, 116)
    doc.setFont('helvetica','normal'); doc.setFontSize(11)
    const scope = ['Survey and design confirmation','Solar PV and battery system design','Supply of equipment','Installation and commissioning','Handover pack and monitoring guidance','Post-installation support']
    scope.forEach((s,i)=>doc.text(`• ${s}`, 18, 130 + i*9))

    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Accreditations & Warranty', 14, 202)
    doc.setFont('helvetica','normal'); doc.setFontSize(11)
    doc.text('MCS Certified · NAPIT Registered · Blue Drop Insurance Backed Warranty', 14, 216)
    doc.text('RECC / TrustMark can be added when confirmed and approved.', 14, 226)
    footer(2)

    // Page 3
    doc.addPage()
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(20)
    doc.text('Financial Summary', 14, 22)
    const boxes = [
      ['Annual Saving', money(annualSaving)],
      ['5 Year Saving', money(annualSaving*5)],
      ['10 Year Saving', money(annualSaving*10)],
      ['25 Year Saving', money(annualSaving*25)]
    ]
    boxes.forEach((b,i)=>{
      const x = i % 2 === 0 ? 14 : 108
      const y = i < 2 ? 42 : 82
      doc.setFillColor(245,248,245); doc.roundedRect(x,y,82,26,3,3,'F')
      doc.setTextColor(100); doc.setFontSize(9); doc.text(b[0], x+6, y+10)
      doc.setTextColor(20); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(b[1], x+6, y+20)
      doc.setFont('helvetica','normal')
    })

    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Uploaded Project Files', 14, 134)
    doc.setFont('helvetica','normal'); doc.setFontSize(10)
    if (files.length === 0) {
      doc.text('No project files have been uploaded against this lead yet.', 14, 148)
    } else {
      files.slice(0,10).forEach((f,i)=>doc.text(`• ${f.file_type}: ${f.file_name}`, 18, 148 + i*8))
    }

    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Customer Acceptance', 14, 222)
    doc.setFont('helvetica','normal'); doc.setFontSize(11)
    doc.text('I confirm I am happy to proceed based on this proposal.', 14, 236)
    doc.line(14, 258, 95, 258); doc.text('Customer signature', 14, 266)
    doc.line(120, 258, 190, 258); doc.text('Date', 120, 266)
    footer(3)

    const safe = (lead?.name || 'customer').replace(/[^a-zA-Z0-9]/g,'-')
    doc.save(`MGEN-Proposal-${safe}.pdf`)
  }

  const pipeline = leads.length * 9500
  const quoteCount = leads.filter(l => ['Proposal Sent','Survey Booked','Won'].includes(l.stage)).length
  const firstLead = leads[0]
  const commercialKw = (commercialPanels * panelWatts) / 1000
  const commercialGeneration = Math.round(commercialKw * 925)
  const commercialSaving = Math.round(commercialGeneration * electricityRate)
  const commercialCo2 = Math.round(commercialGeneration * 0.207 / 1000)
  const commercialCapex = Math.round(commercialKw * 760 + batteryKwh * 350)
  const commercialPayback = commercialSaving ? (commercialCapex / commercialSaving).toFixed(1) : '—'

  const NavButton = ({name}:{name:string}) => <button className={view===name?'active':''} onClick={() => setView(name)}>{name}</button>

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logoWrap">
          <img className="logoImage" src="/mgen-logo.png" alt="MGEN" />
          <div className="logoText">MGEN</div>
          <div className="logoSub">RENEWABLES</div>
          <div className="tagline">Powering smarter energy</div>
        </div>
        <nav className="nav">
          {['Dashboard','Leads','Solar Calculator','Proposals','Customer Journey','Files','Commercial'].map(n => <NavButton key={n} name={n}/>)}
        </nav>
        <div className="userBox"><strong>Gary Scott</strong><span>Sales Manager</span></div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div><h1>MGEN CRM V9</h1><div className="sub">{view} · PDF sales proposal</div></div>
          <button className="btn primary" onClick={() => setLeadModal(true)}>+ New Lead</button>
        </div>

        <div className={status.includes('Connected') || status.includes('saved') ? 'notice good' : 'notice'}>{status}</div>

        {view === 'Dashboard' && (
          <>
            <section className="grid4">
              <div className="card"><div className="metricLabel">Active Leads</div><div className="metricValue">{leads.length}</div><div className="metricUp">Live from Supabase</div></div>
              <div className="card"><div className="metricLabel">Quotes Sent</div><div className="metricValue">{quoteCount}</div><div className="metricUp">Based on stages</div></div>
              <div className="card"><div className="metricLabel">Pipeline Value</div><div className="metricValue">£{Math.round(pipeline/1000)}k</div><div className="metricUp">Estimated</div></div>
              <div className="card"><div className="metricLabel">Proposals</div><div className="metricValue">{proposals.length}</div><div className="metricUp">Saved drafts</div></div>
            </section>
            <section className="layout">
              <div className="card"><h2>Latest Leads</h2><LeadTable leads={leads.slice(0,5)} openProfile={openProfile}/></div>
              <div className="card"><h2>Next Best Actions</h2><div className="journeyStep"><div className="dot">1</div><div><div className="stepTitle">Call {firstLead?.name || 'new lead'}</div><div className="stepText">Follow up highest priority lead</div></div></div><div className="journeyStep"><div className="dot">2</div><div><div className="stepTitle">Download PDF</div><div className="stepText">V9 now creates a PDF file directly</div></div></div><div className="journeyStep"><div className="dot">3</div><div><div className="stepTitle">Add logos</div><div className="stepText">Upload accreditation logos into public/accreditations</div></div></div></div>
            </section>
          </>
        )}

        {view === 'Leads' && (
          <section className="card"><h2>Leads</h2><p className="sub">Click a lead to open profile, uploads and proposal tools.</p><LeadTable leads={leads} openProfile={openProfile}/></section>
        )}

        {view === 'Solar Calculator' && (
          <section className="layout">
            <div className="card"><h2>Domestic Solar Calculator</h2><p className="sub">Select a lead to calculate from annual usage.</p>{leads.map(l => <div className="fileRow clickable" key={l.id} onClick={() => openProfile(l)}><div><div className="fileName">{l.name}</div><div className="fileMeta">{l.annual_usage} kWh · £{l.monthly_bill}/month</div></div><span className="pill">Open</span></div>)}</div>
            <div className="proposalCard"><h2>Calculator Output</h2><p>Open a lead profile to see recommended system, panels, battery, generation, saving and payback.</p></div>
          </section>
        )}

        {view === 'Proposals' && (
          <section className="card">
            <h2>Proposals</h2>
            <p className="sub">V9: preview the sales proposal and download a proper PDF file.</p>
            <table><thead><tr><th>Title</th><th>System</th><th>Panels</th><th>Saving</th><th>Status</th><th>Preview</th></tr></thead><tbody>{proposals.map(p => <tr key={p.id} className="clickable" onClick={()=>openProposal(p)}><td>{p.title}</td><td>{p.system_size_kw}kW</td><td>{p.panel_count}</td><td>{money(Number(p.annual_saving))}</td><td><span className="pill hot">{p.proposal_status}</span></td><td><button className="btn primary small" onClick={(e)=>{e.stopPropagation(); openProposal(p)}}>Preview</button></td></tr>)}{proposals.length===0&&<tr><td colSpan={6}>No proposals yet. Open a lead and click Generate Proposal.</td></tr>}</tbody></table>
          </section>
        )}

        {view === 'Customer Journey' && (
          <section className="layout3">
            <div className="card"><h2>New Lead</h2>{leads.filter(l=>l.stage==='New Lead').map(l=><div className="journeyStep clickable" onClick={()=>openProfile(l)} key={l.id}><div className="dot">1</div><div><div className="stepTitle">{l.name}</div><div className="stepText">{l.postcode}</div></div></div>)}</div>
            <div className="card"><h2>Proposal Sent</h2>{leads.filter(l=>l.stage==='Proposal Sent').map(l=><div className="journeyStep clickable" onClick={()=>openProfile(l)} key={l.id}><div className="dot">2</div><div><div className="stepTitle">{l.name}</div><div className="stepText">Follow up</div></div></div>)}</div>
            <div className="card"><h2>Survey Booked / Won</h2>{leads.filter(l=>['Survey Booked','Won'].includes(l.stage)).map(l=><div className="journeyStep clickable" onClick={()=>openProfile(l)} key={l.id}><div className="dot">3</div><div><div className="stepTitle">{l.name}</div><div className="stepText">{l.stage}</div></div></div>)}</div>
          </section>
        )}

        {view === 'Files' && (
          <section className="card"><h2>Files Centre</h2><p className="sub">Open a lead profile to upload bills, roof photos and commercial drawings. Files are stored in Supabase Storage bucket: lead-files.</p><LeadTable leads={leads} openProfile={openProfile}/></section>
        )}

        {view === 'Commercial' && (
          <section className="layout">
            <div className="card">
              <h2>Commercial Calculator</h2>
              <p className="sub">For existing commercial buildings or new-build projects where there is no bill yet.</p>
              <div className="formGrid">
                <div><label>Mode</label><select value={commercialMode} onChange={e=>setCommercialMode(e.target.value as any)}><option>Existing Building</option><option>New Build</option></select></div>
                <div><label>Usable roof area m²</label><input type="number" value={roofArea} onChange={e=>setRoofArea(Number(e.target.value))}/></div>
                <div><label>Panel count</label><input type="number" value={commercialPanels} onChange={e=>setCommercialPanels(Number(e.target.value))}/></div>
                <div><label>Panel wattage</label><input type="number" value={panelWatts} onChange={e=>setPanelWatts(Number(e.target.value))}/></div>
                <div><label>Battery kWh</label><input type="number" value={batteryKwh} onChange={e=>setBatteryKwh(Number(e.target.value))}/></div>
                <div><label>Electricity rate £/kWh</label><input type="number" step="0.01" value={electricityRate} onChange={e=>setElectricityRate(Number(e.target.value))}/></div>
              </div>
            </div>
            <div className="commercialHero">
              <h2>{commercialMode} Proposal Output</h2>
              <div className="resultGrid">
                <div className="resultBox"><span>System Size</span><strong>{commercialKw.toFixed(2)}kW</strong></div>
                <div className="resultBox"><span>Generation</span><strong>{commercialGeneration.toLocaleString()} kWh</strong></div>
                <div className="resultBox"><span>Annual Saving</span><strong>{money(commercialSaving)}</strong></div>
                <div className="resultBox"><span>Payback</span><strong>{commercialPayback} yrs</strong></div>
                <div className="resultBox"><span>CO₂ Reduction</span><strong>{commercialCo2} t/yr</strong></div>
                <div className="resultBox"><span>Estimated CAPEX</span><strong>{money(commercialCapex)}</strong></div>
              </div>
            </div>
          </section>
        )}
      </main>

      {leadModal && (
        <div className="modalOverlay"><div className="modal">
          <div className="detailHeader"><div><h2>Add New Lead</h2><p className="sub">Create a new MGEN opportunity.</p></div><button className="btn secondary" onClick={()=>setLeadModal(false)}>Close</button></div>
          <form onSubmit={saveLead}>
            <div className="formGrid">
              <div><label>Name</label><input required value={form.name} onChange={e=>updateForm('name',e.target.value)}/></div>
              <div><label>Postcode</label><input value={form.postcode} onChange={e=>updateForm('postcode',e.target.value)}/></div>
              <div className="full"><label>Address</label><input value={form.address} onChange={e=>updateForm('address',e.target.value)}/></div>
              <div><label>Phone</label><input value={form.phone} onChange={e=>updateForm('phone',e.target.value)}/></div>
              <div><label>Email</label><input type="email" value={form.email} onChange={e=>updateForm('email',e.target.value)}/></div>
              <div><label>Monthly bill</label><input type="number" value={form.monthly_bill} onChange={e=>updateForm('monthly_bill',Number(e.target.value))}/></div>
              <div><label>Annual usage</label><input type="number" value={form.annual_usage} onChange={e=>updateForm('annual_usage',Number(e.target.value))}/></div>
              <div><label>Roof type</label><select value={form.roof_type} onChange={e=>updateForm('roof_type',e.target.value)}><option>South-facing</option><option>East/West</option><option>Flat roof</option><option>Commercial flat roof</option><option>New build / plans only</option><option>Unknown</option></select></div>
              <div><label>Stage</label><select value={form.stage} onChange={e=>updateForm('stage',e.target.value)}><option>New Lead</option><option>Contacted</option><option>Bill Uploaded</option><option>Plans Uploaded</option><option>Survey Booked</option><option>Survey Complete</option><option>Proposal Sent</option><option>Follow Up</option><option>Won</option><option>Lost</option></select></div>
              <div className="full"><label>Notes</label><textarea value={form.notes} onChange={e=>updateForm('notes',e.target.value)}/></div>
            </div>
            <div className="modalActions"><button type="button" className="btn secondary" onClick={()=>setLeadModal(false)}>Cancel</button><button className="btn primary">Save Lead</button></div>
          </form>
        </div></div>
      )}

      {profileModal && selectedLead && (
        <div className="modalOverlay"><div className="modal">
          <div className="detailHeader"><div><p className="sub">Lead Profile</p><h2 className="detailName">{selectedLead.name}</h2><p className="sub">{selectedLead.address} · {selectedLead.postcode}</p></div><button className="btn secondary" onClick={()=>setProfileModal(false)}>Close Profile</button></div>
          <Profile lead={selectedLead} leadFiles={leadFiles} fileStatus={fileStatus} uploadLeadFile={uploadLeadFile} getFileUrl={getFileUrl} generateProposal={generateProposal}/>
        </div></div>
      )}

      {proposalModal && selectedProposal && (
        <div className="modalOverlay"><div className="modal proposalModal">
          <div className="proposalActions">
            <button className="btn secondary" onClick={()=>setProposalModal(false)}>Close</button>
            <button className="btn dark" onClick={()=>downloadProposalPdf(selectedProposal, proposalLead, proposalFiles)}>Download Proposal PDF</button>
            <button className="btn primary" onClick={()=>alert('Email proposal will be connected in the next version')}>Email Proposal</button>
          </div>
          <div className="pdfNote">V9 preview below. The PDF button now downloads a file directly instead of opening the browser print screen.</div>
          <ProposalViewer proposal={selectedProposal} lead={proposalLead} files={proposalFiles} getFileUrl={getFileUrl}/>
        </div></div>
      )}
    </div>
  )
}

function LeadTable({leads, openProfile}:{leads:Lead[], openProfile:(l:Lead)=>void}) {
  return <table><thead><tr><th>Name</th><th>Address</th><th>Postcode</th><th>Stage</th><th>Saving</th><th>Profile</th></tr></thead><tbody>{leads.map(lead=><tr key={lead.id||lead.name} className="clickable" onClick={()=>openProfile(lead)}><td>{lead.name}</td><td>{lead.address}</td><td>{lead.postcode}</td><td><span className={lead.stage==='Proposal Sent'?'pill hot':'pill'}>{lead.stage}</span></td><td>{money(calcLead(lead).annualSaving)}/yr</td><td><span className="pill dark">Open</span></td></tr>)}{leads.length===0&&<tr><td colSpan={6}>No leads found.</td></tr>}</tbody></table>
}

function Profile({lead, leadFiles, fileStatus, uploadLeadFile, getFileUrl, generateProposal}:{lead:Lead, leadFiles:LeadFile[], fileStatus:string, uploadLeadFile:(t:string,f?:File|null)=>void, getFileUrl:(p:string)=>string, generateProposal:(l:Lead)=>void}) {
  const c = calcLead(lead)
  return <>
    <div className="detailTabs"><span className="pill dark">{lead.stage}</span><span className="pill blue">Files: {leadFiles.length}</span><span className="pill hot">Proposal Ready</span></div>
    <section className="layout">
      <div className="card"><h2>Customer Details</h2><div className="resultGrid"><div className="resultBox"><span>Phone</span><strong>{lead.phone || '—'}</strong></div><div className="resultBox"><span>Email</span><strong>{lead.email || '—'}</strong></div><div className="resultBox"><span>Monthly Bill</span><strong>{money(Number(lead.monthly_bill||0))}</strong></div><div className="resultBox"><span>Annual Usage</span><strong>{Number(lead.annual_usage||0).toLocaleString()} kWh</strong></div><div className="resultBox"><span>Roof Type</span><strong>{lead.roof_type || 'Unknown'}</strong></div><div className="resultBox"><span>Stage</span><strong>{lead.stage}</strong></div></div><h2 className="sectionTitle">Notes</h2><p className="sub">{lead.notes || 'No notes added yet.'}</p></div>
      <div className="card"><h2>Recommended System</h2><div className="heroSaving"><div className="big">{c.billReduction}%</div><div className="label">Expected Bill Reduction</div></div><div className="resultGrid"><div className="resultBox"><span>Panels</span><strong>{c.panelCount} x 440W</strong></div><div className="resultBox"><span>System Size</span><strong>{c.systemKw.toFixed(2)}kW</strong></div><div className="resultBox"><span>Battery</span><strong>{c.batteryKwh}kWh</strong></div><div className="resultBox"><span>Generation</span><strong>{c.annualGeneration.toLocaleString()} kWh</strong></div><div className="resultBox"><span>Annual Saving</span><strong>{money(c.annualSaving)}</strong></div><div className="resultBox"><span>Payback</span><strong>{c.payback} yrs</strong></div></div></div>
    </section>
    <section className="layout3">
      <div className="card"><h2>Upload Files</h2>{fileStatus && <div className={fileStatus.includes('success')?'notice good':'notice'}>{fileStatus}</div>}<div className="uploadBox">Electricity Bill<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>uploadLeadFile('bill',e.target.files?.[0])}/></div><div className="uploadBox">Roof Photos<input type="file" accept=".jpg,.jpeg,.png,.heic,.pdf" onChange={e=>uploadLeadFile('roof-photo',e.target.files?.[0])}/></div><div className="uploadBox">Commercial Plans / Drawings<input type="file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png" onChange={e=>uploadLeadFile('commercial-plan',e.target.files?.[0])}/></div></div>
      <div className="card"><h2>Lead Files</h2>{leadFiles.length===0&&<p className="sub">No files uploaded yet.</p>}{leadFiles.map(f=><div className="fileRow" key={f.id||f.file_path}><div><div className="fileName">{f.file_name}</div><div className="fileMeta">{f.file_type}</div></div><a className="btn secondary small" href={getFileUrl(f.file_path)} target="_blank">Open</a></div>)}</div>
      <div className="card"><h2>Proposal</h2><p className="sub">Generate an MGEN branded draft proposal record.</p><div className="resultGrid"><div className="resultBox"><span>Status</span><strong>Draft</strong></div><div className="resultBox"><span>Views</span><strong>0</strong></div></div><br/><button className="btn primary" onClick={()=>generateProposal(lead)}>Generate Proposal</button></div>
    </section>
  </>
}

function AccreditationLogos() {
  return <div className="accredStrip">
    <img className="accredLogo" src="/accreditations/mcs-logo.png" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
    <img className="accredLogo" src="/accreditations/napit-logo.png" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
    <img className="accredLogo" src="/accreditations/blue-drop-logo.png" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
    <img className="accredLogo" src="/accreditations/recc-logo.png" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
    <img className="accredLogo" src="/accreditations/trustmark-logo.png" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
    <span className="accredBadge">MCS</span>
    <span className="accredBadge">NAPIT</span>
    <span className="accredBadge">Blue Drop</span>
  </div>
}

function ProposalViewer({proposal, lead, files, getFileUrl}:{proposal:Proposal, lead:Lead|null, files:LeadFile[], getFileUrl:(p:string)=>string}) {
  const annualSaving = Number(proposal.annual_saving || 0)
  const generation = Number(proposal.annual_generation || 0)
  const co2 = Math.round(generation * 0.207 / 1000 * 10) / 10
  const fiveYear = annualSaving * 5
  const tenYear = annualSaving * 10
  const twentyFiveYear = annualSaving * 25
  const reference = `MGEN-${new Date().getFullYear()}-${String(proposal.id || 1).padStart(4,'0')}`
  const date = proposal.created_at ? new Date(proposal.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')
  const imageFiles = files.filter(f => ['roof-photo','commercial-plan'].includes(f.file_type) && !f.file_name.toLowerCase().endsWith('.pdf'))

  return <div className="proposalSheet">
    <section className="proposalCover">
      <div>
        <div className="proposalLogoBlock">
          <img src="/mgen-logo.png" alt="MGEN Renewables" />
          <div className="proposalBrand">MGEN<small>RENEWABLES</small></div>
        </div>
        <div className="proposalTitle">Save up to {money(annualSaving)} per year</div>
        <div className="proposalSub">Solar PV & battery proposal prepared for {lead?.name || 'your customer'}.</div>
        <div className="proposalRef">
          <strong>Proposal Reference:</strong> {reference}<br/>
          <strong>Date:</strong> {date}<br/>
          <strong>Status:</strong> {proposal.proposal_status || 'Draft'}
        </div>
        <AccreditationLogos />
      </div>
      <div className="proposalClient">
        <h3>Customer Details</h3>
        <p><strong>Name:</strong><br/>{lead?.name || 'Customer not linked'}</p>
        <p><strong>Address:</strong><br/>{lead?.address || '—'}</p>
        <p><strong>Postcode:</strong><br/>{lead?.postcode || '—'}</p>
        <p><strong>Phone:</strong> {lead?.phone || '—'}</p>
        <p><strong>Email:</strong> {lead?.email || '—'}</p>
      </div>
    </section>

    <section className="proposalBody">
      <div className="proposalKpis">
        <div className="proposalKpi"><span>System Size</span><strong>{proposal.system_size_kw}kW</strong></div>
        <div className="proposalKpi"><span>Panels</span><strong>{proposal.panel_count}</strong></div>
        <div className="proposalKpi"><span>Battery</span><strong>{proposal.battery_kwh}kWh</strong></div>
        <div className="proposalKpi"><span>Payback</span><strong>{proposal.payback_years} yrs</strong></div>
      </div>

      <div className="proposalTwo">
        <div className="proposalSection">
          <h3>Recommended System</h3>
          <ul>
            <li>{proposal.panel_count} high efficiency solar panels</li>
            <li>Estimated system size of {proposal.system_size_kw}kW</li>
            <li>{proposal.battery_kwh}kWh battery storage option</li>
            <li>Hybrid inverter and monitoring app</li>
            <li>Designed to reduce grid reliance and improve energy control</li>
          </ul>
        </div>
        <div className="proposalDark">
          <h3>Estimated Performance</h3>
          <div className="resultGrid">
            <div className="resultBox"><span>Annual Generation</span><strong>{generation.toLocaleString()} kWh</strong></div>
            <div className="resultBox"><span>Annual Saving</span><strong>{money(annualSaving)}</strong></div>
            <div className="resultBox"><span>25 Year Benefit</span><strong>{money(twentyFiveYear)}</strong></div>
            <div className="resultBox"><span>CO₂ Reduction</span><strong>{co2} t/yr</strong></div>
          </div>
        </div>
      </div>

      <div className="proposalTwo">
        <div className="proposalSection">
          <h3>Roof / Design Preview</h3>
          {imageFiles[0] ? <img className="proposalPhoto" src={getFileUrl(imageFiles[0].file_path)} alt="Uploaded roof/design file" /> : <div className="roofPlaceholder">Roof image, panel layout or commercial drawing preview will display here once attached.</div>}
        </div>
        <div className="proposalSection">
          <h3>Financial Summary</h3>
          <div className="resultGrid">
            <div className="resultBox"><span>Annual Saving</span><strong>{money(annualSaving)}</strong></div>
            <div className="resultBox"><span>5 Year Saving</span><strong>{money(fiveYear)}</strong></div>
            <div className="resultBox"><span>10 Year Saving</span><strong>{money(tenYear)}</strong></div>
            <div className="resultBox"><span>25 Year Saving</span><strong>{money(twentyFiveYear)}</strong></div>
          </div>
        </div>
      </div>

      <div className="proposalTwo">
        <div className="proposalSection">
          <h3>Scope of Works</h3>
          <ul>
            <li>Survey and design confirmation</li>
            <li>Solar PV and battery system design</li>
            <li>Supply of equipment</li>
            <li>Installation and commissioning</li>
            <li>Handover pack and monitoring guidance</li>
            <li>Post-installation support</li>
          </ul>
        </div>
        <div className="proposalSection">
          <h3>Accreditations & Warranty</h3>
          <div className="trustBadges">
            <span>MCS</span>
            <span>NAPIT</span>
            <span>Blue Drop Warranty Protected</span>
            <span>RECC / HIES</span>
            <span>TrustMark</span>
          </div>
        </div>
      </div>

      <div className="proposalSection">
        <h3>Uploaded Project Files</h3>
        {files.length === 0 && <p className="sub">No files uploaded against this lead yet. Upload bills, roof photos or drawings from the lead profile.</p>}
        {files.map(file => <div className="fileRow" key={file.id || file.file_path}>
          <div><div className="fileName">{file.file_name}</div><div className="fileMeta">{file.file_type}</div></div>
          <a className="btn secondary small" href={getFileUrl(file.file_path)} target="_blank">Open</a>
        </div>)}
      </div>

      <div className="proposalTwo">
        <div className="proposalSection">
          <h3>Customer Acceptance</h3>
          <p className="sub">I confirm I am happy to proceed based on the proposal information provided.</p>
          <div className="signatureBox">Customer Signature</div>
        </div>
        <div className="proposalSection">
          <h3>Next Steps</h3>
          <ul>
            <li>Confirm acceptance of proposal</li>
            <li>Book technical survey</li>
            <li>Finalise design and installation date</li>
            <li>Complete installation and handover</li>
          </ul>
        </div>
      </div>
    </section>

    <footer className="proposalFooter">
      <div>MGEN Renewables · Powering smarter energy</div>
      <div>Proposal prepared by Gary Scott</div>
    </footer>
  </div>
}
