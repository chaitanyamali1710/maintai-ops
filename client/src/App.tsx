import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, Bot, Boxes, CheckCircle2, ChevronRight,
  ClipboardList, Factory, Gauge, LayoutDashboard, LogOut, Menu, Pause, PlayCircle, Plus,
  RotateCcw, Search, Settings, ShieldCheck, Sparkles, Thermometer, Wrench, X, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import api from './api';
import type { Alert, DashboardData, Machine, ReplayCatalogue, ReplayStep, WorkOrder } from './types';

type Page = 'overview' | 'machines' | 'alerts' | 'work-orders' | 'replay' | 'assistant' | 'settings';

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'machines', label: 'Machines', icon: Factory },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'work-orders', label: 'Work orders', icon: ClipboardList },
  { id: 'replay', label: 'Fault replay', icon: PlayCircle },
  { id: 'assistant', label: 'AI copilot', icon: Bot },
  { id: 'settings', label: 'System', icon: Settings }
] as const;

const FAULT_LABELS: Record<string,string> = {
  normal: 'Healthy', inner_race: 'Inner race fault',
  ball: 'Ball fault', outer_race: 'Outer race fault'
};
const pretty = (label: string) => FAULT_LABELS[label] ?? label;

const fallback: DashboardData = {
  machines: [], alerts: [], workOrders: [],
  metrics: { totalMachines: 0, operational: 0, activeAlerts: 0, averageHealth: 0, avoidedDowntimeHours: 0 }
};

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('admin@maintai.dev');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('maintai_token', data.token);
      localStorage.setItem('maintai_user', JSON.stringify(data.user));
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to sign in. Is the API running?');
    } finally { setBusy(false); }
  }

  return <div className="login-shell">
    <div className="login-visual">
      <div className="grid-glow" />
      <div className="brand"><span className="brand-mark"><Activity size={22}/></span> MaintAI</div>
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14}/> INDUSTRIAL INTELLIGENCE</span>
        <h1>See failures before they stop production.</h1>
        <p>One operations center for equipment health, AI-assisted diagnostics and evidence-backed maintenance decisions.</p>
        <div className="hero-stats">
          <div><strong>24/7</strong><span>Live monitoring</span></div>
          <div><strong>91%</strong><span>Demo prediction accuracy</span></div>
          <div><strong>&lt;2s</strong><span>Alert response</span></div>
        </div>
      </div>
      <div className="signal-card"><span className="signal-pulse"/><div><strong>Compressor C-12</strong><small>Anomaly detected 8 seconds ago</small></div><span className="risk-pill">82% risk</span></div>
    </div>
    <div className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><span className="brand-mark"><Activity size={20}/></span> MaintAI</div>
        <span className="kicker">OPERATIONS PORTAL</span>
        <h2>Welcome back</h2><p>Sign in to monitor your industrial assets.</p>
        <label>Work email<input value={email} onChange={e => setEmail(e.target.value)} type="email" required/></label>
        <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" required/></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ChevronRight size={18}/></>}</button>
        <div className="demo-note"><ShieldCheck size={16}/><span>Demo: admin@maintai.dev / Admin@123</span></div>
      </form>
    </div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}><i/>{status.replace('-', ' ')}</span>;
}

function MetricCard({ icon: Icon, label, value, sub, tone }: any) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></article>;
}

function MachineTable({ machines, onSelect }: { machines: Machine[], onSelect: (m: Machine) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Asset</th><th>Status</th><th>Health</th><th>Temperature</th><th>Vibration</th><th>Risk</th><th/></tr></thead>
    <tbody>{machines.map(m => <tr key={m.id} onClick={() => onSelect(m)}><td><div className="asset-cell"><span className="asset-icon"><Boxes size={18}/></span><div><strong>{m.name}</strong><small>{m.id} · {m.location}</small></div></div></td><td><StatusBadge status={m.status}/></td><td><div className="health"><span>{m.health}%</span><div><i style={{width:`${m.health}%`}}/></div></div></td><td>{m.reading.temperature.toFixed(1)}°C</td><td>{m.reading.vibration.toFixed(1)} mm/s</td><td><strong className={m.reading.riskScore > 65 ? 'danger-text' : 'safe-text'}>{m.reading.riskScore}%</strong></td><td><ChevronRight size={16}/></td></tr>)}</tbody>
  </table>{!machines.length && <div className="empty">Waiting for machine data…</div>}</div>;
}

function MachineDrawer({ machine, close }: { machine: Machine | null, close: () => void }) {
  if (!machine) return null;
  return <div className="drawer-backdrop" onClick={close}><aside className="drawer" onClick={e => e.stopPropagation()}>
    <button className="icon-btn drawer-close" onClick={close}><X size={20}/></button>
    <span className="kicker">ASSET DETAILS</span><h2>{machine.name}</h2><p>{machine.id} · {machine.type} · {machine.location}</p>
    <div className="drawer-health"><div><span>Health score</span><strong>{machine.health}%</strong></div><StatusBadge status={machine.status}/></div>
    <div className="sensor-grid">
      <div><Thermometer/><span>Temperature</span><strong>{machine.reading.temperature.toFixed(1)} °C</strong></div>
      <div><Activity/><span>Vibration</span><strong>{machine.reading.vibration.toFixed(1)} mm/s</strong></div>
      <div><Gauge/><span>Pressure</span><strong>{machine.reading.pressure.toFixed(1)} bar</strong></div>
      <div><Zap/><span>Power</span><strong>{machine.reading.power.toFixed(1)} kW</strong></div>
    </div>
    <h3>Last readings</h3><div className="mini-chart"><ResponsiveContainer width="100%" height={190}><LineChart data={machine.history}><CartesianGrid stroke="#1c2a3d" vertical={false}/><XAxis dataKey="timestamp" tickFormatter={v => new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} stroke="#62718a" fontSize={11}/><YAxis stroke="#62718a" fontSize={11}/><Tooltip contentStyle={{background:'#101b2c',border:'1px solid #26354b',borderRadius:12}}/><Line type="monotone" dataKey="temperature" stroke="#44dfb1" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="vibration" stroke="#ffb45b" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>
    <button className="primary-btn"><Wrench size={17}/> Create maintenance order</button>
  </aside></div>;
}

function AlertsView({ alerts, refresh }: { alerts: Alert[], refresh: () => void }) {
  async function acknowledge(id: string) { await api.patch(`/alerts/${id}/acknowledge`); refresh(); }
  return <section className="content-card"><div className="section-head"><div><span className="kicker">RISK CENTER</span><h2>Active alerts</h2></div><span className="count-badge">{alerts.filter(a=>!a.acknowledged).length} open</span></div>
    <div className="alert-list">{alerts.map(a => <article className={`alert-row severity-${a.severity}`} key={a.id}><span className="alert-icon"><AlertTriangle size={19}/></span><div><strong>{a.title}</strong><p>{a.message}</p><small>{a.machineName} · {new Date(a.createdAt).toLocaleString()}</small></div>{a.acknowledged ? <span className="ack"><CheckCircle2 size={16}/> Acknowledged</span> : <button className="soft-btn" onClick={() => acknowledge(a.id)}>Acknowledge</button>}</article>)}</div>
  </section>;
}

function WorkOrdersView({ orders, refresh }: { orders: WorkOrder[], refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ machineId:'VAC-104', title:'Inspect abnormal vibration', priority:'high', assignedTo:'Maintenance Team' });
  async function create(e: FormEvent) { e.preventDefault(); await api.post('/work-orders', form); setOpen(false); refresh(); }
  return <><section className="content-card"><div className="section-head"><div><span className="kicker">MAINTENANCE</span><h2>Work orders</h2></div><button className="primary-small" onClick={()=>setOpen(true)}><Plus size={16}/> New order</button></div>
    <div className="order-grid">{orders.map(o => <article className="order-card" key={o.id}><div><span className={`priority priority-${o.priority}`}>{o.priority}</span><StatusBadge status={o.status}/></div><h3>{o.title}</h3><p>{o.machineName} · {o.machineId}</p><footer><span><Wrench size={15}/>{o.assignedTo}</span><small>Due {new Date(o.dueDate).toLocaleDateString()}</small></footer></article>)}</div></section>
    {open && <div className="modal-backdrop"><form className="modal" onSubmit={create}><div className="section-head"><h2>Create work order</h2><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X/></button></div><label>Machine ID<input value={form.machineId} onChange={e=>setForm({...form,machineId:e.target.value})}/></label><label>Task<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>low</option><option>medium</option><option>high</option></select></label><label>Assign to<input value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}/></label><button className="primary-btn">Create order</button></form></div>}</>;
}

function AssistantView({ machines }: { machines: Machine[] }) {
  const [question, setQuestion] = useState('What should I inspect when a vacuum pump has high temperature and vibration?');
  const [messages, setMessages] = useState<{role:string,text:string,sources?:string[]}[]>([{role:'ai',text:'I can combine machine readings, maintenance history and manual evidence. Ask me about an asset or failure symptom.'}]);
  const [busy, setBusy] = useState(false);
  async function ask(e: FormEvent) { e.preventDefault(); if (!question.trim()) return; const q=question; setMessages(v=>[...v,{role:'user',text:q}]); setQuestion(''); setBusy(true); try { const {data}=await api.post('/ai/ask',{question:q,machineId:machines[0]?.id}); setMessages(v=>[...v,{role:'ai',text:data.answer,sources:data.sources}]); } catch { setMessages(v=>[...v,{role:'ai',text:'The AI service is unavailable. Start FastAPI on port 8000 and try again.'}]); } finally {setBusy(false);} }
  return <section className="assistant-layout"><div className="assistant-main"><div className="assistant-title"><span className="ai-orb"><Bot/></span><div><span className="kicker">EVIDENCE COPILOT</span><h2>Maintenance assistant</h2></div><span className="online"><i/> Online</span></div><div className="messages">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==='ai'&&<span><Bot size={18}/></span>}<div><p>{m.text}</p>{m.sources?.length ? <div className="sources">{m.sources.map(s=><small key={s}><ClipboardList size={13}/>{s}</small>)}</div>:null}</div></div>)}{busy&&<div className="typing"><i/><i/><i/></div>}</div><form className="ask-bar" onSubmit={ask}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about a machine, symptom or maintenance procedure…"/><button><Sparkles size={18}/></button></form></div><aside className="context-panel"><span className="kicker">LIVE CONTEXT</span><h3>Connected evidence</h3><div className="context-item"><Factory/><div><strong>{machines.length} machines</strong><small>Live telemetry available</small></div></div><div className="context-item"><ClipboardList/><div><strong>4 manual sections</strong><small>Indexed for retrieval</small></div></div><div className="context-item"><Activity/><div><strong>Sensor history</strong><small>Last 24-hour window</small></div></div><div className="guardrail"><ShieldCheck/><div><strong>Decision support only</strong><p>Recommendations require technician verification.</p></div></div></aside></section>;
}

function ReplayView() {
  const [catalogue, setCatalogue] = useState<ReplayCatalogue|null>(null);
  const [scenario, setScenario] = useState('degradation');
  const [step, setStep] = useState<ReplayStep|null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<ReplayStep[]>([]);
  const [problem, setProblem] = useState('');

  useEffect(()=>{ api.get('/replay/scenarios')
    .then(r=>{ setCatalogue(r.data); if(!r.data.available) setProblem('Replay needs a trained model. Run training/train.py then training/export_replay.py.'); })
    .catch(()=>setProblem('AI service unavailable — start FastAPI on port 8000.')); },[]);

  // Each tick asks the backend to classify the next recorded window. The model sees one
  // window at a time with no memory, exactly as it would on a live machine.
  useEffect(()=>{ if(!playing) return;
    const timer = setInterval(async()=>{
      try {
        const { data } = await api.post('/replay/step', { scenario, index });
        setStep(data); setHistory(h=>[...h.slice(-39), data]); setIndex(i=>i+1);
      } catch { setProblem('Replay step failed — is the AI service running?'); setPlaying(false); }
    }, 900);
    return ()=>clearInterval(timer);
  },[playing, scenario, index]);

  function reset(next = scenario) {
    setScenario(next); setIndex(0); setStep(null); setHistory([]); setPlaying(false); setProblem('');
  }

  const active = catalogue?.scenarios.find(s=>s.id===scenario);
  const seen = history.length;
  const accuracy = seen ? Math.round(history.filter(h=>h.correct).length / seen * 100) : null;
  const trace = (step?.waveform ?? []).map((v,i)=>({ i, v }));

  return <section className="replay-layout">
    <div className="page-title"><div><span className="kicker">MODEL REPLAY</span><h1>Bearing fault replay</h1>
      <p>Real CWRU vibration recordings streamed through the trained classifier, one window at a time.</p></div></div>

    {problem && <div className="api-banner"><AlertTriangle size={17}/>{problem}</div>}

    <div className="replay-controls content-card">
      <div className="replay-scenarios">
        {catalogue?.scenarios.map(s=>
          <button key={s.id} className={s.id===scenario?'chip active':'chip'} onClick={()=>reset(s.id)}>
            {s.id==='degradation' ? 'Healthy → fault' : pretty(s.trueLabel)}
          </button>)}
      </div>
      <div className="replay-buttons">
        <button className="primary-small" onClick={()=>setPlaying(p=>!p)} disabled={!catalogue?.available}>
          {playing ? <><Pause size={16}/> Pause</> : <><PlayCircle size={16}/> Play</>}
        </button>
        <button className="text-btn" onClick={()=>reset()}><RotateCcw size={15}/> Restart</button>
      </div>
    </div>

    {catalogue && <p className="replay-note"><ShieldCheck size={15}/>
      {catalogue.note} Recorded at {catalogue.heldOutLoadHp} hp,
      {' '}{catalogue.windowSize} samples per window at {catalogue.samplingRate/1000} kHz.
    </p>}

    <div className="replay-grid">
      <section className="content-card chart-card">
        <div className="section-head"><div><span className="kicker">RAW VIBRATION</span>
          <h2>{active ? (active.id==='degradation' ? 'Healthy → fault run' : pretty(active.trueLabel)) : 'Waveform'}</h2></div>
          <span className="legend"><i/>Window {step ? step.index+1 : 0} of {step?.total ?? active?.windows ?? 0}</span></div>
        <div className="main-chart"><ResponsiveContainer width="100%" height={240}>
          <LineChart data={trace}><CartesianGrid stroke="#e8edf4" vertical={false}/>
            <XAxis dataKey="i" hide/><YAxis stroke="#8b97aa" fontSize={11} domain={['auto','auto']}/>
            <Line type="monotone" dataKey="v" stroke={step?.isFault?'#e4572e':'#12ad82'} strokeWidth={1.4} dot={false} isAnimationActive={false}/>
          </LineChart></ResponsiveContainer></div>
      </section>

      <section className="content-card replay-verdict">
        <div className="section-head"><div><span className="kicker">MODEL PREDICTION</span><h2>Diagnosis</h2></div>
          {step && <span className={step.correct?'verdict-ok':'verdict-bad'}>{step.correct?<CheckCircle2 size={15}/>:<X size={15}/>}{step.correct?'Agrees':'Disagrees'}</span>}</div>
        {step ? <>
          <div className={`replay-call ${step.isFault?'fault':'ok'}`}>
            <strong>{pretty(step.predictedFault)}</strong>
            <small>confidence {(step.confidence*100).toFixed(1)}%</small>
          </div>
          <div className="replay-truth">Ground truth: <b>{pretty(step.trueLabel)}</b></div>
          <div className="prob-bars">{Object.entries(step.probabilities).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
            <div className="prob-row" key={k}><span>{pretty(k)}</span>
              <i><b style={{width:`${Math.max(2,v*100)}%`}}/></i><small>{(v*100).toFixed(0)}%</small></div>)}</div>
          <div className="replay-stats">
            <div><strong>{accuracy ?? '—'}%</strong><small>agreement over {seen} windows</small></div>
            <div><strong>{step.rmsAmplitude.toFixed(3)}</strong><small>RMS amplitude</small></div>
          </div>
        </> : <div className="replay-idle"><PlayCircle size={34}/><p>Press play to stream recorded windows through the model.</p></div>}
      </section>
    </div>
  </section>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('maintai_token')));
  const [page, setPage] = useState<Page>('overview');
  const [data, setData] = useState<DashboardData>(fallback);
  const [selected, setSelected] = useState<Machine|null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  async function load() { try { const res=await api.get('/dashboard'); setData(res.data); setError(''); } catch (e:any) { if(e.response?.status===401){localStorage.clear();setAuthenticated(false);} else setError('Live API unavailable — start the backend on port 5000.'); } }
  useEffect(()=>{ if(!authenticated)return; load(); const id=setInterval(load,5000); return()=>clearInterval(id); },[authenticated]);
  const filtered = useMemo(()=>data.machines.filter(m=>`${m.name} ${m.id} ${m.location}`.toLowerCase().includes(query.toLowerCase())),[data.machines,query]);
  if(!authenticated) return <Login onLogin={()=>setAuthenticated(true)}/>;

  function logout(){localStorage.clear();setAuthenticated(false);}
  return <div className="app-shell">
    <aside className={`sidebar ${sidebar?'sidebar-open':''}`}><div className="brand"><span className="brand-mark"><Activity size={21}/></span> MaintAI</div><div className="facility"><span>FACILITY</span><strong>Pune Plant 01</strong><small><i/> Connected</small></div><nav>{nav.map(item=><button className={page===item.id?'active':''} key={item.id} onClick={()=>{setPage(item.id);setSidebar(false)}}><item.icon size={18}/>{item.label}{item.id==='alerts'&&data.metrics.activeAlerts>0?<b>{data.metrics.activeAlerts}</b>:null}</button>)}</nav><div className="sidebar-foot"><div className="user-avatar">CM</div><div><strong>Chaitanya Mali</strong><small>System administrator</small></div><button onClick={logout}><LogOut size={17}/></button></div></aside>
    <main><header><button className="menu-btn" onClick={()=>setSidebar(!sidebar)}><Menu/></button><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search machines, alerts or reports…"/></div><div className="header-actions"><span className="live"><i/> LIVE</span><button className="icon-btn"><Bell size={18}/><b/></button><div className="avatar">CM</div></div></header>
      <div className="page-content">{error&&<div className="api-banner"><AlertTriangle size={17}/>{error}</div>}
      {page==='overview'&&<><div className="page-title"><div><span className="kicker">PLANT OVERVIEW</span><h1>Good morning, Chaitanya</h1><p>Here is what is happening across your operation.</p></div><div className="updated"><i/>Updated {new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>
        <div className="metrics"><MetricCard icon={Factory} label="Total assets" value={data.metrics.totalMachines} sub={`${data.metrics.operational} operating normally`} tone="mint"/><MetricCard icon={Activity} label="Average health" value={`${data.metrics.averageHealth}%`} sub="Across monitored equipment" tone="blue"/><MetricCard icon={AlertTriangle} label="Active alerts" value={data.metrics.activeAlerts} sub="Requires attention" tone="orange"/><MetricCard icon={ShieldCheck} label="Avoided downtime" value={`${data.metrics.avoidedDowntimeHours}h`} sub="Estimated this month" tone="purple"/></div>
        <div className="dashboard-grid"><section className="content-card chart-card"><div className="section-head"><div><span className="kicker">LIVE TELEMETRY</span><h2>Temperature trend</h2></div><span className="legend"><i/>Temperature °C</span></div><div className="main-chart"><ResponsiveContainer width="100%" height={290}><AreaChart data={data.machines[0]?.history||[]}><defs><linearGradient id="temp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#45e0b2" stopOpacity={.35}/><stop offset="100%" stopColor="#45e0b2" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8edf4" vertical={false}/><XAxis dataKey="timestamp" tickFormatter={v=>new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} stroke="#8b97aa" fontSize={11}/><YAxis stroke="#8b97aa" fontSize={11}/><Tooltip/><Area type="monotone" dataKey="temperature" stroke="#12ad82" fill="url(#temp)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div></section><section className="content-card risk-panel"><div className="section-head"><div><span className="kicker">AI RISK WATCH</span><h2>Priority assets</h2></div><Sparkles size={18}/></div>{[...data.machines].sort((a,b)=>b.reading.riskScore-a.reading.riskScore).slice(0,3).map(m=><button className="risk-machine" key={m.id} onClick={()=>setSelected(m)}><span className={`risk-ring ${m.reading.riskScore>65?'high':''}`}>{m.reading.riskScore}</span><div><strong>{m.name}</strong><small>{m.reading.riskScore>65?'Inspection recommended':'Within normal range'}</small></div><ChevronRight size={16}/></button>)}<div className="ai-summary"><Bot/><p><strong>AI summary</strong> Compressor C-12 shows a rising vibration pattern. Check bearing lubrication within 8 hours.</p></div></section></div>
        <section className="content-card"><div className="section-head"><div><span className="kicker">ASSET FLEET</span><h2>Machine health</h2></div><button className="text-btn" onClick={()=>setPage('machines')}>View all <ChevronRight size={15}/></button></div><MachineTable machines={filtered.slice(0,5)} onSelect={setSelected}/></section></>}
      {page==='machines'&&<section className="content-card"><div className="section-head"><div><span className="kicker">ASSET MANAGEMENT</span><h2>All machines</h2></div><button className="primary-small"><Plus size={16}/> Register asset</button></div><MachineTable machines={filtered} onSelect={setSelected}/></section>}
      {page==='alerts'&&<AlertsView alerts={data.alerts} refresh={load}/>} {page==='work-orders'&&<WorkOrdersView orders={data.workOrders} refresh={load}/>} {page==='replay'&&<ReplayView/>} {page==='assistant'&&<AssistantView machines={data.machines}/>} {page==='settings'&&<section className="content-card settings-card"><span className="kicker">PLATFORM STATUS</span><h2>System configuration</h2><div className="system-row"><div><span className="system-icon"><Boxes/></span><div><strong>Database</strong><small>MongoDB Atlas or local fallback</small></div></div><StatusBadge status="healthy"/></div><div className="system-row"><div><span className="system-icon"><Bot/></span><div><strong>AI service</strong><small>FastAPI anomaly and RAG engine</small></div></div><StatusBadge status="healthy"/></div><div className="system-row"><div><span className="system-icon"><ShieldCheck/></span><div><strong>Security</strong><small>JWT, RBAC, rate limits and audit-ready events</small></div></div><StatusBadge status="healthy"/></div></section>}
      </div></main><MachineDrawer machine={selected} close={()=>setSelected(null)}/></div>;
}

export default App;
