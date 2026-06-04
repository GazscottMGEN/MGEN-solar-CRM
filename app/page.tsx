'use client'

import { useEffect, useMemo, useState } from 'react'

type Lead = {
  id: number
  name: string
  address: string
  postcode: string
  phone: string
  email: string
  monthlyBill: number
  annualUsage: number
  roofType: string
  stage: string
  notes: string
}

const defaultLeads: Lead[] = [
  {
    id: 1,
    name: 'John Smith',
    address: 'Sunderland',
    postcode: 'SR1',
    phone: '07700 900111',
    email: 'john@example.com',
    monthlyBill: 180,
    annualUsage: 4800,
    roofType: 'South-facing',
    stage: 'Proposal Sent',
    notes: 'Hot lead. Proposal viewed multiple times.'
  },
  {
    id: 2,
    name: 'Sarah Jones',
    address: 'Newcastle',
    postcode: 'NE1',
    phone: '07700 900222',
    email: 'sarah@example.com',
    monthlyBill: 145,
    annualUsage: 4200,
    roofType: 'East/West',
    stage: 'Survey Booked',
    notes: 'Survey booked.'
  },
  {
    id: 3,
    name: 'Michael Brown',
    address: 'Durham',
    postcode: 'DH1',
    phone: '07700 900333',
    email: 'michael@example.com',
    monthlyBill: 160,
    annualUsage: 4500,
    roofType: 'Unknown',
    stage: 'New Lead',
    notes: 'Needs bill upload.'
  }
]

const emptyForm = {
  name: '',
  address: '',
  postcode: '',
  phone: '',
  email: '',
  monthlyBill: 180,
  annualUsage: 4800,
  roofType: 'South-facing',
  stage: 'New Lead',
  notes: ''
}

export default function Home() {
  const [projectType, setProjectType] = useState<'Domestic' | 'Commercial'>('Domestic')
  const [monthlyBill, setMonthlyBill] = useState(180)
  const [panels, setPanels] = useState(14)
  const [panelWatts, setPanelWatts] = useState(440)
  const [battery, setBattery] = useState(10)
  const [systemPrice, setSystemPrice] = useState(10500)
  const [modalOpen, setModalOpen] = useState(false)
  const [leads, setLeads] = useState<Lead[]>(defaultLeads)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const saved = localStorage.getItem('mgen-leads')
    if (saved) {
      try {
        setLeads(JSON.parse(saved))
      } catch {
        setLeads(defaultLeads)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('mgen-leads', JSON.stringify(leads))
  }, [leads])

  const calc = useMemo(() => {
    const annualBill = monthlyBill * 12
    const sizeKw = (panels * panelWatts) / 1000
    const generationFactor = projectType === 'Commercial' ? 925 : 900
    const annualGeneration = Math.round(sizeKw * generationFactor)
    const afterSolarFactor = projectType === 'Commercial'
      ? (battery > 0 ? 0.18 : 0.28)
      : (battery > 0 ? 0.22 : 0.38)
    const estimatedAfterSolar = Math.max(annualBill * afterSolarFactor, projectType === 'Commercial' ? 500 : 240)
    const annualSaving = Math.round(annualBill - estimatedAfterSolar)
    const billReduction = Math.round((annualSaving / annualBill) * 100)
    const payback = annualSaving > 0 ? (systemPrice / annualSaving).toFixed(1) : '—'
    const lifetimeSaving = annualSaving * 25
    return { annualBill, sizeKw, annualGeneration, annualSaving, billReduction, payback, lifetimeSaving }
  }, [monthlyBill, panels, panelWatts, battery, systemPrice, projectType])

  function leadSaving(lead: Lead) {
    const annualBill = lead.monthlyBill * 12
    return Math.round(annualBill * 0.78)
  }

  function openLeadModal() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function saveLead(e: React.FormEvent) {
    e.preventDefault()

    const newLead: Lead = {
      id: Date.now(),
      ...form,
      monthlyBill: Number(form.monthlyBill),
      annualUsage: Number(form.annualUsage)
    }

    setLeads([newLead, ...leads])
    setMonthlyBill(Number(form.monthlyBill))
    setModalOpen(false)
  }

  function updateForm(field: keyof typeof emptyForm, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const pipelineValue = leads.length * 9500
  const quoteCount = leads.filter(l => l.stage === 'Proposal Sent' || l.stage === 'Survey Booked').length

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
          <button>Reports</button>
          <button>Settings</button>
        </nav>
        <div className="userBox">
          <strong>Gary Scott</strong>
          <span>Sales Manager</span>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>MGEN Solar CRM</h1>
            <div className="sub">Internal sales platform for MGEN Renewables.</div>
          </div>
          <div className="segment">
            <button className={projectType === 'Domestic' ? 'selected' : ''} onClick={() => setProjectType('Domestic')}>Domestic</button>
            <button className={projectType === 'Commercial' ? 'selected' : ''} onClick={() => setProjectType('Commercial')}>Commercial</button>
          </div>
          <button className="btn primary" onClick={openLeadModal}>+ New Lead</button>
        </div>

        <section className="grid4">
          <div className="card"><div className="metricLabel">Active Leads</div><div className="metricValue">{leads.length}</div><div className="metricUp">Live lead count</div></div>
          <div className="card"><div className="metricLabel">Quotes Sent</div><div className="metricValue">{quoteCount}</div><div className="metricUp">From lead stages</div></div>
          <div className="card"><div className="metricLabel">Pipeline Value</div><div className="metricValue">£{Math.round(pipelineValue/1000)}k</div><div className="metricUp">Estimated pipeline</div></div>
          <div className="card"><div className="metricLabel">Conversion Rate</div><div className="metricValue">42%</div><div className="metricUp">Demo metric</div></div>
        </section>

        <section className="layout">
          <div className="card">
            <h2>{projectType} Solar Calculator</h2>
            <p className="sub">Change the inputs and the recommendation updates instantly.</p>

            <div className="formGrid">
              <div>
                <label>{projectType === 'Commercial' ? 'Monthly electricity spend' : 'Monthly electricity bill'}</label>
                <input type="number" value={monthlyBill} onChange={e => setMonthlyBill(Number(e.target.value))} />
              </div>
              <div>
                <label>Number of panels</label>
                <input type="number" value={panels} onChange={e => setPanels(Number(e.target.value))} />
              </div>
              <div>
                <label>Panel wattage</label>
                <select value={panelWatts} onChange={e => setPanelWatts(Number(e.target.value))}>
                  <option value={430}>430W</option>
                  <option value={440}>440W</option>
                  <option value={450}>450W</option>
                  <option value={500}>500W</option>
                </select>
              </div>
              <div>
                <label>Battery size</label>
                <select value={battery} onChange={e => setBattery(Number(e.target.value))}>
                  <option value={0}>No battery</option>
                  <option value={5}>5kWh</option>
                  <option value={10}>10kWh</option>
                  <option value={15}>15kWh</option>
                  <option value={30}>30kWh Commercial</option>
                </select>
              </div>
              <div>
                <label>System price</label>
                <input type="number" value={systemPrice} onChange={e => setSystemPrice(Number(e.target.value))} />
              </div>
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
                <thead><tr><th>Customer</th><th>Status</th><th>Value</th></tr></thead>
                <tbody>
                  {leads.slice(0, 3).map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.name}</td>
                      <td><span className={lead.stage === 'Proposal Sent' ? 'pill hot' : 'pill'}>{lead.stage}</span></td>
                      <td>£{(leadSaving(lead) * 6).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="layout3">
          <div className="card">
            <h2>Customer Journey</h2>
            <div className="journeyStep"><div className="dot">✓</div><div><div className="stepTitle">Lead Created</div><div className="stepText">Website enquiry added to CRM</div></div></div>
            <div className="journeyStep"><div className="dot">✓</div><div><div className="stepTitle">Bill Uploaded</div><div className="stepText">Usage ready for recommendation</div></div></div>
            <div className="journeyStep"><div className="dot">✓</div><div><div className="stepTitle">Proposal Sent</div><div className="stepText">MGEN branded proposal issued</div></div></div>
            <div className="journeyStep"><div className="dot">✓</div><div><div className="stepTitle">Proposal Viewed</div><div className="stepText">Customer opened proposal 3 times</div></div></div>
            <div className="journeyStep"><div className="dot todo">○</div><div><div className="stepTitle">Survey Booked</div><div className="stepText">Next recommended action</div></div></div>
          </div>

          <div className="card">
            <h2>Proposal Engagement</h2>
            <div className="metricLabel">{leads[0]?.name || 'No lead selected'}</div>
            <div className="engagementBig">3 views</div>
            <p className="sub">Last opened today at 7:41pm</p>
            <div className="resultGrid">
              <div className="resultBox"><span>Time spent</span><strong>11m</strong></div>
              <div className="resultBox"><span>Hot score</span><strong>92%</strong></div>
            </div>
          </div>

          <div className="card">
            <h2>Next Best Actions</h2>
            <div className="journeyStep"><div className="dot">1</div><div><div className="stepTitle">Call {leads[0]?.name || 'new lead'}</div><div className="stepText">Highest priority lead</div></div></div>
            <div className="journeyStep"><div className="dot">2</div><div><div className="stepTitle">Confirm survey</div><div className="stepText">Check booked appointments</div></div></div>
            <div className="journeyStep"><div className="dot">3</div><div><div className="stepTitle">Request bill</div><div className="stepText">Missing usage data</div></div></div>
          </div>
        </section>

        <h2 className="sectionTitle">Leads</h2>
        <section className="card">
          <table>
            <thead><tr><th>Name</th><th>Address</th><th>Postcode</th><th>Stage</th><th>Estimated Saving</th><th>Next Action</th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.address}</td>
                  <td>{lead.postcode}</td>
                  <td><span className={lead.stage === 'Proposal Sent' ? 'pill hot' : 'pill'}>{lead.stage}</span></td>
                  <td>£{leadSaving(lead).toLocaleString()}/yr</td>
                  <td>{lead.stage === 'New Lead' ? 'Upload bill' : lead.stage === 'Survey Booked' ? 'Site survey' : 'Call today'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <h2 className="sectionTitle">Proposal Preview</h2>
        <section className="layout">
          <div className="proposalHero">
            <h2>MGEN Recommended Solar System</h2>
            <p>{panels} x {panelWatts}W panels + {battery}kWh battery</p>
            <div className="roofBox">Customer Roof Image<br/>+ Solar Panel Layout Placeholder</div>
          </div>
          <div className="card">
            <h2>Proposal Trust Section</h2>
            <p className="sub">Accreditation logos will sit here once uploaded.</p>
            <div className="accred">
              <div className="badge">MCS</div>
              <div className="badge">RECC / HIES</div>
              <div className="badge">TrustMark</div>
              <div className="badge">NAPIT</div>
              <div className="badge">Manufacturer Approved</div>
            </div>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalHead">
              <div>
                <h2>Add New Lead</h2>
                <p className="sub">Create a new MGEN solar opportunity.</p>
              </div>
              <button className="btn secondary" onClick={() => setModalOpen(false)}>Close</button>
            </div>

            <form onSubmit={saveLead}>
              <div className="formGrid">
                <div>
                  <label>Customer name</label>
                  <input required value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="e.g. Gary Scott" />
                </div>
                <div>
                  <label>Postcode</label>
                  <input value={form.postcode} onChange={e => updateForm('postcode', e.target.value)} placeholder="e.g. SR1 1AA" />
                </div>
                <div className="full">
                  <label>Address</label>
                  <input value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Customer address" />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="07700 900000" />
                </div>
                <div>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="customer@email.com" />
                </div>
                <div>
                  <label>Monthly electricity bill</label>
                  <input type="number" value={form.monthlyBill} onChange={e => updateForm('monthlyBill', Number(e.target.value))} />
                </div>
                <div>
                  <label>Annual usage</label>
                  <input type="number" value={form.annualUsage} onChange={e => updateForm('annualUsage', Number(e.target.value))} />
                </div>
                <div>
                  <label>Roof type</label>
                  <select value={form.roofType} onChange={e => updateForm('roofType', e.target.value)}>
                    <option>South-facing</option>
                    <option>East/West</option>
                    <option>Flat roof</option>
                    <option>Unknown</option>
                  </select>
                </div>
                <div>
                  <label>Stage</label>
                  <select value={form.stage} onChange={e => updateForm('stage', e.target.value)}>
                    <option>New Lead</option>
                    <option>Bill Uploaded</option>
                    <option>Proposal Sent</option>
                    <option>Survey Booked</option>
                    <option>Won</option>
                    <option>Lost</option>
                  </select>
                </div>
                <div className="full">
                  <label>Notes</label>
                  <textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Add any useful sales notes..." />
                </div>
              </div>

              <div className="modalActions">
                <button type="button" className="btn secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
