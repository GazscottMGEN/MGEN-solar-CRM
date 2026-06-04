'use client'

import { useMemo, useState } from 'react'

export default function Home() {
  const [monthlyBill, setMonthlyBill] = useState(180)
  const [panels, setPanels] = useState(14)
  const [panelWatts, setPanelWatts] = useState(440)
  const [battery, setBattery] = useState(10)
  const [systemPrice, setSystemPrice] = useState(10500)

  const calc = useMemo(() => {
    const annualBill = monthlyBill * 12
    const sizeKw = (panels * panelWatts) / 1000
    const annualGeneration = Math.round(sizeKw * 900)
    const estimatedAfterSolar = Math.max(annualBill * (battery > 0 ? 0.22 : 0.38), 240)
    const annualSaving = Math.round(annualBill - estimatedAfterSolar)
    const billReduction = Math.round((annualSaving / annualBill) * 100)
    const payback = annualSaving > 0 ? (systemPrice / annualSaving).toFixed(1) : '—'
    const lifetimeSaving = annualSaving * 25
    return { annualBill, sizeKw, annualGeneration, annualSaving, billReduction, payback, lifetimeSaving }
  }, [monthlyBill, panels, panelWatts, battery, systemPrice])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logoWrap">
          <img className="logoImage" src="/mgen-logo.png" alt="MGEN Renewables logo" />
          <div className="logoText">MGEN</div>
          <div className="logoSub">RENEWABLES</div>
        </div>
        <nav className="nav">
          <button className="active">Dashboard</button>
          <button>Leads</button>
          <button>Solar Calculator</button>
          <button>Proposals</button>
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
          <button className="btn primary">+ New Lead</button>
        </div>

        <section className="grid4">
          <div className="card"><div className="metricLabel">Active Leads</div><div className="metricValue">24</div><div className="metricUp">+6 this week</div></div>
          <div className="card"><div className="metricLabel">Quotes Sent</div><div className="metricValue">18</div><div className="metricUp">+4 this week</div></div>
          <div className="card"><div className="metricLabel">Pipeline Value</div><div className="metricValue">£187k</div><div className="metricUp">+£32k this month</div></div>
          <div className="card"><div className="metricLabel">Conversion Rate</div><div className="metricValue">42%</div><div className="metricUp">+8% this month</div></div>
        </section>

        <section className="layout">
          <div className="card">
            <h2>Solar Calculator</h2>
            <p className="sub">Change the inputs and the recommendation updates instantly.</p>

            <div className="formGrid">
              <div>
                <label>Monthly electricity bill</label>
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
                  <tr><td>John Smith</td><td><span className="pill">Quote viewed</span></td><td>£10,500</td></tr>
                  <tr><td>Sarah Jones</td><td><span className="pill">Survey booked</span></td><td>£8,950</td></tr>
                  <tr><td>Michael Brown</td><td><span className="pill">Follow up</span></td><td>£12,200</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <h2 className="sectionTitle">Leads</h2>
        <section className="card">
          <table>
            <thead><tr><th>Name</th><th>Address</th><th>Stage</th><th>Estimated Saving</th><th>Next Action</th></tr></thead>
            <tbody>
              <tr><td>John Smith</td><td>Sunderland</td><td><span className="pill">Proposal Sent</span></td><td>£1,685/yr</td><td>Call today</td></tr>
              <tr><td>Sarah Jones</td><td>Newcastle</td><td><span className="pill">Survey Booked</span></td><td>£1,240/yr</td><td>Site survey</td></tr>
              <tr><td>Michael Brown</td><td>Durham</td><td><span className="pill">New Lead</span></td><td>£1,480/yr</td><td>Upload bill</td></tr>
            </tbody>
          </table>
        </section>

        <h2 className="sectionTitle">Proposal Preview</h2>
        <section className="layout">
          <div className="proposalHero">
            <h2>MGEN Recommended Solar System</h2>
            <p>{panels} x {panelWatts}W panels + {battery}kWh battery</p>
            <div className="roofBox">Customer Roof Image + Panel Layout Placeholder</div>
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
    </div>
  )
}
