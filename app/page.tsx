'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey)
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null

const emptyForm: Lead = {
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

function calculateLeadSaving(lead: Lead) {
  const annualBill = Number(lead.monthly_bill || 0) * 12
  return Math.round(annualBill * 0.78)
}

function calculateLeadSystem(lead: Lead) {
  const usage = Number(lead.annual_usage || 0)
  const recommendedKw = usage > 0 ? usage / 900 : 5
  const panels = Math.max(8, Math.ceil((recommendedKw * 1000) / 440))
  const actualKw = (panels * 440) / 1000
  const battery = usage > 5000 ? 10 : 5
  const generation = Math.round(actualKw * 900)
  const annualSaving = calculateLeadSaving(lead)
  const price = Math.round(2500 + panels * 430 + battery * 650)
  const payback = annualSaving > 0 ? (price / annualSaving).toFixed(1) : '—'
  const billReduction = lead.monthly_bill ? Math.round((annualSaving / (lead.monthly_bill * 12)) * 100) : 0
  return { panels, actualKw, battery, generation, annualSaving, price, payback, billReduction }
}

export default function Home() {
  const [projectType, setProjectType] = useState<'Domestic' | 'Commercial'>('Domestic')
  const [monthlyBill, setMonthlyBill] = useState(180)
  const [panels, setPanels] = useState(14)
  const [panelWatts, setPanelWatts] = useState(440)
  const [battery, setBattery] = useState(10)
  const [systemPrice, setSystemPrice] = useState(10500)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadFiles, setLeadFiles] = useState<LeadFile[]>([])
  const [form, setForm] = useState<Lead>(emptyForm)
  const [status, setStatus] = useState(hasSupabase ? 'Connected to Supabase' : 'Supabase env vars not added yet')
  const [fileStatus, setFileStatus] = useState('')

  useEffect(() => { loadLeads() }, [])

  async function loadLeads() {
    if (supabase) {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (!error && data) {
        setLeads(data)
        setStatus(data.length ? 'Connected to Supabase' : 'Connected to Supabase — no leads yet')
        return
      }
      setStatus('Supabase read failed. Check table/policies.')
    }
  }

  async function loadLeadFiles(leadId: number) {
    if (!supabase) return
    const { data, error } = await supabase.from('lead_files').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    if (!error && data) setLeadFiles(data)
    if (error) setFileStatus('File table not ready yet — run V6 SQL.')
  }

  const calc = useMemo(() => {
    const annualBill = monthlyBill * 12
    const sizeKw = (panels * panelWatts) / 1000
    const generationFactor = projectType === 'Commercial' ? 925 : 900
    const annualGeneration = Math.round(sizeKw * generationFactor)
    const afterSolarFactor = projectType === 'Commercial' ? (battery > 0 ? 0.18 : 0.28) : (battery > 0 ? 0.22 : 0.38)
    const estimatedAfterSolar = Math.max(annualBill * afterSolarFactor, projectType === 'Commercial' ? 500 : 240)
    const annualSaving = Math.round(annualBill - estimatedAfterSolar)
    const billReduction = Math.round((annualSaving / annualBill) * 100)
    const payback = annualSaving > 0 ? (systemPrice / annualSaving).toFixed(1) : '—'
    const lifetimeSaving = annualSaving * 25
    return { annualBill, sizeKw, annualGeneration, annualSaving, billReduction, payback, lifetimeSaving }
  }, [monthlyBill, panels, panelWatts, battery, systemPrice, projectType])

  function openLeadModal() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  async function openDetail(lead: Lead) {
    setSelectedLead(lead)
    setDetailOpen(true)
    setFileStatus('')
    setLeadFiles([])
    if (lead.id) await loadLeadFiles(lead.id)
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault()
    const newLead: Lead = { ...form, monthly_bill: Number(form.monthly_bill), annual_usage: Number(form.annual_usage) }

    if (supabase) {
      const { data, error } = await supabase.from('leads').insert([newLead]).select().single()
      if (!error && data) {
        setLeads([data, ...leads])
        setStatus('Lead saved to Supabase')
      } else {
        setStatus('Supabase save failed. Check RLS policies.')
      }
    }
    setMonthlyBill(Number(form.monthly_bill))
    setModalOpen(false)
  }

  function updateForm(field: keyof Lead, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function uploadLeadFile(fileType: string, file?: File | null) {
    if (!file || !selectedLead?.id || !supabase) return

    setFileStatus('Uploading file...')
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${selectedLead.id}/${fileType}/${Date.now()}-${safeName}`

    const upload = await supabase.storage.from('lead-files').upload(path, file, { upsert: false })
    if (upload.error) {
      setFileStatus('Upload failed. Check Supabase Storage bucket named lead-files and storage policies.')
      return
    }

    const record = {
      lead_id: selectedLead.id,
      file_name: file.name,
      file_type: fileType,
      file_path: path
    }

    const inserted = await supabase.from('lead_files').insert([record]).select().single()
    if (inserted.error) {
      setFileStatus('File uploaded, but database record failed. Run the V6 SQL.')
      return
    }

    setLeadFiles([inserted.data, ...leadFiles])
    setFileStatus('File uploaded and saved against lead')
  }

  function getPublicUrl(path: string) {
    if (!supabase) return '#'
    const { data } = supabase.storage.from('lead-files').getPublicUrl(path)
    return data.publicUrl
  }

  const pipelineValue = leads.length * 9500
  const quoteCount = leads.filter(l => l.stage === 'Proposal Sent' || l.stage === 'Survey Booked').length
  const firstLead = leads[0]
  const selectedCalc = selectedLead ? calculateLeadSystem(selectedLead) : null

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logoWrap">
          <img className="logoImage" src="/mgen-logo.png" alt="MGEN Renewables logo" />
          <div className="logoText">MGEN</div>
          <div className="logoSub">RENEWABLES</div>
          <div className="tagline">Powering smarter energy</div>
        </div>
        <nav className="nav">
          <button className="active">Dashboard</button>
          <button>Leads</button>
          <button>Solar Calculator</button>
          <button>Proposals</button>
          <button>Customer Journey</button>
          <button>Files</button>
          <button>Commercial</button>
        </nav>
        <div className="userBox"><strong>Gary Scott</strong><span>Sales Manager</span></div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>MGEN CRM V6</h1>
            <div className="sub">Live leads with bill, roof photo and commercial plan uploads.</div>
          </div>
          <div className="segment">
            <button className={projectType === 'Domestic' ? 'selected' : ''} onClick={() => setProjectType('Domestic')}>Domestic</button>
            <button className={projectType === 'Commercial' ? 'selected' : ''} onClick={() => setProjectType('Commercial')}>Commercial</button>
          </div>
          <button className="btn primary" onClick={openLeadModal}>+ New Lead</button>
        </div>

        <div className="notice">{status}</div>

        <section className="grid4">
          <div className="card"><div className="metricLabel">Active Leads</div><div className="metricValue">{leads.length}</div><div className="metricUp">Live from Supabase</div></div>
          <div className="card"><div className="metricLabel">Quotes Sent</div><div className="metricValue">{quoteCount}</div><div className="metricUp">Based on lead stages</div></div>
          <div className="card"><div className="metricLabel">Pipeline Value</div><div className="metricValue">£{Math.round(pipelineValue/1000)}k</div><div className="metricUp">Estimated pipeline</div></div>
          <div className="card"><div className="metricLabel">File Centre</div><div className="metricValue">V6</div><div className="metricUp">Bills / roof / plans</div></div>
        </section>

        <section className="layout">
          <div className="card">
            <h2>{projectType} Solar Calculator</h2>
            <p className="sub">Change the inputs and the recommendation updates instantly.</p>
            <div className="formGrid">
              <div><label>{projectType === 'Commercial' ? 'Monthly electricity spend' : 'Monthly electricity bill'}</label><input type="number" value={monthlyBill} onChange={e => setMonthlyBill(Number(e.target.value))} /></div>
              <div><label>Number of panels</label><input type="number" value={panels} onChange={e => setPanels(Number(e.target.value))} /></div>
              <div><label>Panel wattage</label><select value={panelWatts} onChange={e => setPanelWatts(Number(e.target.value))}><option value={430}>430W</option><option value={440}>440W</option><option value={450}>450W</option><option value={500}>500W</option></select></div>
              <div><label>Battery size</label><select value={battery} onChange={e => setBattery(Number(e.target.value))}><option value={0}>No battery</option><option value={5}>5kWh</option><option value={10}>10kWh</option><option value={15}>15kWh</option><option value={30}>30kWh Commercial</option></select></div>
              <div><label>System price</label><input type="number" value={systemPrice} onChange={e => setSystemPrice(Number(e.target.value))} /></div>
            </div>
            <div className="resultGrid">
              <div className="resultBox"><span>Recommended System</span><strong>{calc.sizeKw.toFixed(2)}kW</strong></div>
              <div className="resultBox"><span>Estimated Generation</span><strong>{calc.annualGeneration.toLocaleString()} kWh</strong></div>
              <div className="resultBox"><span>Annual Saving</span><strong>£{calc.annualSaving.toLocaleString()}</strong></div>
              <div className="resultBox"><span>Payback</span><strong>{calc.payback} years</strong></div>
            </div>
          </div>

          <div>
            <div className="heroSaving">
              <div className="big">{calc.billReduction}%</div>
              <div className="label">Expected Bill Reduction</div>
              <p>Estimated annual saving: £{calc.annualSaving.toLocaleString()}</p>
              <p>Estimated 25-year benefit: £{calc.lifetimeSaving.toLocaleString()}</p>
            </div>
            <div className="card">
              <h2>Hot Leads</h2>
              <table>
                <thead><tr><th>Customer</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {leads.slice(0, 3).map((lead) => (
                    <tr key={lead.id || lead.name} className="clickable" onClick={() => openDetail(lead)}>
                      <td>{lead.name}</td>
                      <td><span className={lead.stage === 'Proposal Sent' ? 'pill hot' : 'pill'}>{lead.stage}</span></td>
                      <td>Open profile</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <h2 className="sectionTitle">Live Leads</h2>
        <section className="card">
          <table>
            <thead><tr><th>Name</th><th>Address</th><th>Postcode</th><th>Stage</th><th>Estimated Saving</th><th>Profile</th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id || lead.name} className="clickable" onClick={() => openDetail(lead)}>
                  <td>{lead.name}</td>
                  <td>{lead.address}</td>
                  <td>{lead.postcode}</td>
                  <td><span className={lead.stage === 'Proposal Sent' ? 'pill hot' : 'pill'}>{lead.stage}</span></td>
                  <td>£{calculateLeadSaving(lead).toLocaleString()}/yr</td>
                  <td><span className="pill dark">Open</span></td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={6}>No leads yet. Click + New Lead to add one.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="layout3">
          <div className="card"><h2>Customer Journey</h2><div className="journeyStep"><div className="dot">✓</div><div><div className="stepTitle">Lead Created</div><div className="stepText">Lead saved to CRM</div></div></div><div className="journeyStep"><div className="dot todo">○</div><div><div className="stepTitle">Files Uploaded</div><div className="stepText">Bill, roof photos or plans</div></div></div><div className="journeyStep"><div className="dot todo">○</div><div><div className="stepTitle">Proposal Generated</div><div className="stepText">Next V7 feature</div></div></div></div>
          <div className="card"><h2>File Centre</h2><p className="sub">V6 stores bills, roof photos and commercial drawings against each lead.</p><div className="resultBox"><span>Storage bucket</span><strong>lead-files</strong></div></div>
          <div className="card"><h2>Next Best Actions</h2><div className="journeyStep"><div className="dot">1</div><div><div className="stepTitle">Upload lead files</div><div className="stepText">Start collecting bills and plans</div></div></div><div className="journeyStep"><div className="dot">2</div><div><div className="stepTitle">Generate proposal</div><div className="stepText">Coming in V7</div></div></div></div>
        </section>
      </main>

      {modalOpen && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalHead"><div><h2>Add New Lead</h2><p className="sub">Create a new MGEN solar opportunity.</p></div><button className="btn secondary" onClick={() => setModalOpen(false)}>Close</button></div>
            <form onSubmit={saveLead}>
              <div className="formGrid">
                <div><label>Customer name</label><input required value={form.name} onChange={e => updateForm('name', e.target.value)} /></div>
                <div><label>Postcode</label><input value={form.postcode} onChange={e => updateForm('postcode', e.target.value)} /></div>
                <div className="full"><label>Address</label><input value={form.address} onChange={e => updateForm('address', e.target.value)} /></div>
                <div><label>Phone</label><input value={form.phone} onChange={e => updateForm('phone', e.target.value)} /></div>
                <div><label>Email</label><input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} /></div>
                <div><label>Monthly electricity bill</label><input type="number" value={form.monthly_bill} onChange={e => updateForm('monthly_bill', Number(e.target.value))} /></div>
                <div><label>Annual usage</label><input type="number" value={form.annual_usage} onChange={e => updateForm('annual_usage', Number(e.target.value))} /></div>
                <div><label>Roof type</label><select value={form.roof_type} onChange={e => updateForm('roof_type', e.target.value)}><option>South-facing</option><option>East/West</option><option>Flat roof</option><option>Commercial flat roof</option><option>New build / plans only</option><option>Unknown</option></select></div>
                <div><label>Stage</label><select value={form.stage} onChange={e => updateForm('stage', e.target.value)}><option>New Lead</option><option>Bill Uploaded</option><option>Plans Uploaded</option><option>Proposal Sent</option><option>Survey Booked</option><option>Won</option><option>Lost</option></select></div>
                <div className="full"><label>Notes</label><textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} /></div>
              </div>
              <div className="modalActions"><button type="button" className="btn secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="btn primary">Save Lead</button></div>
            </form>
          </div>
        </div>
      )}

      {detailOpen && selectedLead && selectedCalc && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="detailHeader">
              <div><p className="sub">Lead Profile</p><h2 className="detailName">{selectedLead.name}</h2><p className="sub">{selectedLead.address} · {selectedLead.postcode}</p></div>
              <button className="btn secondary" onClick={() => setDetailOpen(false)}>Close Profile</button>
            </div>

            <div className="detailTabs"><span className="pill dark">{selectedLead.stage}</span><span className="pill">Files: {leadFiles.length}</span><span className="pill hot">V6 Upload Centre</span></div>

            <section className="layout">
              <div className="card">
                <h2>Customer Details</h2>
                <div className="resultGrid">
                  <div className="resultBox"><span>Phone</span><strong>{selectedLead.phone || '—'}</strong></div>
                  <div className="resultBox"><span>Email</span><strong>{selectedLead.email || '—'}</strong></div>
                  <div className="resultBox"><span>Monthly Bill</span><strong>£{Number(selectedLead.monthly_bill || 0).toLocaleString()}</strong></div>
                  <div className="resultBox"><span>Annual Usage</span><strong>{Number(selectedLead.annual_usage || 0).toLocaleString()} kWh</strong></div>
                  <div className="resultBox"><span>Roof Type</span><strong>{selectedLead.roof_type || 'Unknown'}</strong></div>
                  <div className="resultBox"><span>Stage</span><strong>{selectedLead.stage}</strong></div>
                </div>
                <h2 className="sectionTitle">Notes</h2>
                <p className="sub">{selectedLead.notes || 'No notes added yet.'}</p>
              </div>

              <div className="card">
                <h2>Recommended System</h2>
                <div className="heroSaving"><div className="big">{selectedCalc.billReduction}%</div><div className="label">Expected Bill Reduction</div></div>
                <div className="resultGrid">
                  <div className="resultBox"><span>Panels</span><strong>{selectedCalc.panels} x 440W</strong></div>
                  <div className="resultBox"><span>System Size</span><strong>{selectedCalc.actualKw.toFixed(2)}kW</strong></div>
                  <div className="resultBox"><span>Battery</span><strong>{selectedCalc.battery}kWh</strong></div>
                  <div className="resultBox"><span>Generation</span><strong>{selectedCalc.generation.toLocaleString()} kWh</strong></div>
                  <div className="resultBox"><span>Annual Saving</span><strong>£{selectedCalc.annualSaving.toLocaleString()}</strong></div>
                  <div className="resultBox"><span>Payback</span><strong>{selectedCalc.payback} yrs</strong></div>
                </div>
              </div>
            </section>

            <section className="layout3">
              <div className="card">
                <h2>Upload Files</h2>
                <p className="sub">Files will be saved in Supabase Storage against this lead.</p>
                {fileStatus && <div className={fileStatus.includes('failed') || fileStatus.includes('Check') ? 'notice warn' : 'notice'}>{fileStatus}</div>}
                <div className="uploadBox">
                  Electricity Bill
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => uploadLeadFile('bill', e.target.files?.[0])} />
                </div>
                <div className="uploadBox">
                  Roof Photos
                  <input type="file" accept=".jpg,.jpeg,.png,.heic,.pdf" onChange={e => uploadLeadFile('roof-photo', e.target.files?.[0])} />
                </div>
                <div className="uploadBox">
                  Commercial Plans / Drawings
                  <input type="file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png" onChange={e => uploadLeadFile('commercial-plan', e.target.files?.[0])} />
                </div>
              </div>

              <div className="card">
                <h2>Lead Files</h2>
                {leadFiles.length === 0 && <p className="sub">No files uploaded yet.</p>}
                {leadFiles.map(file => (
                  <div className="fileRow" key={file.id || file.file_path}>
                    <div>
                      <div className="fileName">{file.file_name}</div>
                      <div className="fileMeta">{file.file_type}</div>
                    </div>
                    <a className="btn secondary small" href={getPublicUrl(file.file_path)} target="_blank">Open</a>
                  </div>
                ))}
              </div>

              <div className="card">
                <h2>Proposal</h2>
                <p className="sub">V7 will generate branded MGEN proposals using lead data and uploaded files.</p>
                <div className="resultGrid">
                  <div className="resultBox"><span>Status</span><strong>Draft</strong></div>
                  <div className="resultBox"><span>Views</span><strong>0</strong></div>
                </div>
                <br/>
                <button className="btn primary">Generate Proposal</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
