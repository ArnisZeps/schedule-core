// Client booking widget — 5-step wizard.
// Steps: service → staff → date → time → confirm → success
const { Scissors: WIScis, Clock: WIClock, ArrowR: WIArrR, ArrowL: WIArrL,
        Check: WICheck, CheckCircle: WICC, MapPin: WIPin, User: WIUser,
        Calendar: WICal, Phone: WIPhone, Mail: WIMail } = window.SC_ICONS;
const WD = window.SC_DATA;

function SCBookingWidget({ initialStep = 0 }) {
  const [step, setStep] = React.useState(initialStep);
  const [picked, setPicked] = React.useState({
    service: 's2', staff: 'b1', date: 6, time: '10:30',
    name: 'James Carter', phone: '+1 (415) 555-0148', email: 'james@hey.co', notes: '',
  });
  const set = (k, v) => setPicked((p) => ({ ...p, [k]: v }));

  const stepLabels = ['Service', 'Barber', 'Date', 'Time', 'Confirm'];

  const svc = WD.serviceById[picked.service];
  const stf = WD.staffById[picked.staff];

  return (
    <div className="sc-widget sc-surface" data-theme="light">
      <div className="sc-widget-head">
        <div className="sc-widget-tenant">
          <div className="sc-brandmark" style={{ width: 32, height: 32, borderRadius: 8 }}>N</div>
          <div className="sc-grow">
            <h2>Northside Barbers</h2>
            <p className="sc-row" style={{ gap: 6 }}>
              <WIPin size={11} /> 412 Belmont Ave
            </p>
          </div>
        </div>
        {step < 5 && (
          <>
            <div className="sc-stepper">
              {stepLabels.map((_, i) => (
                <div key={i} className={`sc-stepper-dot ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}`} />
              ))}
            </div>
            <div className="sc-stepper-label">Step {step + 1} of 5 · {stepLabels[step]}</div>
          </>
        )}
      </div>

      <div className="sc-widget-body">
        {step === 0 && <StepService picked={picked.service} onPick={(v) => set('service', v)} />}
        {step === 1 && <StepStaff service={svc} picked={picked.staff} onPick={(v) => set('staff', v)} />}
        {step === 2 && <StepDate picked={picked.date} onPick={(v) => set('date', v)} />}
        {step === 3 && <StepTime picked={picked.time} onPick={(v) => set('time', v)} />}
        {step === 4 && <StepConfirm picked={picked} svc={svc} stf={stf} onChange={set} />}
        {step === 5 && <StepSuccess picked={picked} svc={svc} stf={stf} />}
      </div>

      {step < 5 && (
        <div className="sc-widget-foot">
          <button className="sc-btn sc-btn-ghost sc-btn-sm"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <WIArrL size={14} /> Back
          </button>
          <div className="sc-mute" style={{ fontSize: 12 }}>
            {svc.name} · {svc.dur} min · ${svc.price}
          </div>
          <button className="sc-btn sc-btn-primary sc-btn-sm"
                  onClick={() => setStep((s) => s + 1)}>
            {step === 4 ? 'Confirm booking' : 'Continue'} <WIArrR size={14} />
          </button>
        </div>
      )}
      {step === 5 && (
        <div className="sc-widget-foot" style={{ justifyContent: 'center' }}>
          <button className="sc-btn sc-btn-outline sc-btn-sm">Add to calendar</button>
          <button className="sc-btn sc-btn-primary sc-btn-sm">Done</button>
        </div>
      )}
    </div>
  );
}

function StepService({ picked, onPick }) {
  return (
    <div className="sc-stack" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Choose a service</h3>
      <p className="sc-mute" style={{ fontSize: 13, marginTop: 0, marginBottom: 8 }}>What would you like today?</p>
      {WD.services.map((s) => (
        <button key={s.id}
                className={`sc-tile ${picked === s.id ? 'selected' : ''}`}
                onClick={() => onPick(s.id)}>
          <div className="sc-tile-icon"><WIScis size={18} /></div>
          <div className="sc-tile-main">
            <div className="sc-tile-title">{s.name}</div>
            <div className="sc-tile-meta">{s.dur} min · {s.desc}</div>
          </div>
          <div className="sc-tile-price">${s.price}</div>
        </button>
      ))}
    </div>
  );
}

function StepStaff({ service, picked, onPick }) {
  const opts = [{ id: '__any', name: 'Any available', role: 'First to come free', initials: '✦' }, ...WD.staff];
  return (
    <div className="sc-stack" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Pick your barber</h3>
      <p className="sc-mute" style={{ fontSize: 13, marginTop: 0, marginBottom: 8 }}>For your {service.name.toLowerCase()}.</p>
      {opts.map((s) => (
        <button key={s.id}
                className={`sc-tile ${picked === s.id ? 'selected' : ''}`}
                onClick={() => onPick(s.id)}>
          <div className="sc-tile-icon" style={{ borderRadius: 999 }}>{s.initials}</div>
          <div className="sc-tile-main">
            <div className="sc-tile-title">{s.name}</div>
            <div className="sc-tile-meta">{s.role}</div>
          </div>
          {s.id !== '__any' && <span className="sc-badge sc-badge-success">Available</span>}
        </button>
      ))}
    </div>
  );
}

function StepDate({ picked, onPick }) {
  const dates = [
    { d: 4,  dow: 'Mon', avail: 'Few left' },
    { d: 5,  dow: 'Tue', avail: 'Available' },
    { d: 6,  dow: 'Wed', avail: 'Available' },
    { d: 7,  dow: 'Thu', avail: 'Available' },
    { d: 8,  dow: 'Fri', avail: 'Few left' },
    { d: 9,  dow: 'Sat', avail: 'Full', disabled: true },
    { d: 10, dow: 'Sun', avail: 'Closed', disabled: true },
    { d: 11, dow: 'Mon', avail: 'Available' },
    { d: 12, dow: 'Tue', avail: 'Available' },
    { d: 13, dow: 'Wed', avail: 'Available' },
    { d: 14, dow: 'Thu', avail: 'Available' },
    { d: 15, dow: 'Fri', avail: 'Available' },
    { d: 16, dow: 'Sat', avail: 'Few left' },
    { d: 17, dow: 'Sun', avail: 'Closed', disabled: true },
  ];
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Choose a date</h3>
      <p className="sc-mute" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>May 2026</p>
      <div className="sc-datestrip" style={{ marginBottom: 8 }}>
        {dates.slice(0, 7).map((d) => (
          <button key={d.d}
                  className={`sc-datechip ${picked === d.d ? 'selected' : ''} ${d.disabled ? 'disabled' : ''}`}
                  onClick={() => !d.disabled && onPick(d.d)}>
            <span className="sc-dow">{d.dow}</span>
            <span className="sc-dnum">{d.d}</span>
          </button>
        ))}
      </div>
      <div className="sc-datestrip">
        {dates.slice(7, 14).map((d) => (
          <button key={d.d}
                  className={`sc-datechip ${picked === d.d ? 'selected' : ''} ${d.disabled ? 'disabled' : ''}`}
                  onClick={() => !d.disabled && onPick(d.d)}>
            <span className="sc-dow">{d.dow}</span>
            <span className="sc-dnum">{d.d}</span>
          </button>
        ))}
      </div>
      <div className="sc-divider" />
      <div className="sc-row" style={{ gap: 12, fontSize: 12 }}>
        <span className="sc-row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--sc-fg)' }} /> Selected</span>
        <span className="sc-row sc-mute" style={{ gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, border: '1px solid var(--sc-border)' }} /> Available</span>
        <span className="sc-row sc-mute" style={{ gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--sc-muted)' }} /> Full / closed</span>
      </div>
    </div>
  );
}

function StepTime({ picked, onPick }) {
  const all = [...WD.slots.morning, ...WD.slots.afternoon];
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Pick a time</h3>
      <p className="sc-mute" style={{ fontSize: 13, marginTop: 0, marginBottom: 4 }}>Wednesday, May 6 · with Marco</p>
      <div className="sc-slot-section">Morning</div>
      <div className="sc-slotgrid">
        {WD.slots.morning.map((t) => (
          <button key={t} className={`sc-slot ${picked === t ? 'selected' : ''}`} onClick={() => onPick(t)}>{t}</button>
        ))}
        {['10:00', '11:30'].map((t) => (
          <button key={t} className="sc-slot disabled" disabled>{t}</button>
        ))}
      </div>
      <div className="sc-slot-section">Afternoon</div>
      <div className="sc-slotgrid">
        {WD.slots.afternoon.map((t) => (
          <button key={t} className={`sc-slot ${picked === t ? 'selected' : ''}`} onClick={() => onPick(t)}>{t}</button>
        ))}
        {['13:30', '14:00', '15:00', '16:30'].map((t) => (
          <button key={t} className="sc-slot disabled" disabled>{t}</button>
        ))}
      </div>
    </div>
  );
}

function StepConfirm({ picked, svc, stf, onChange }) {
  return (
    <div className="sc-stack" style={{ gap: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Your details</h3>
      <div className="sc-card" style={{ padding: 14 }}>
        <div className="sc-stack" style={{ gap: 8 }}>
          <div className="sc-row" style={{ justifyContent: 'space-between' }}>
            <span className="sc-mute" style={{ fontSize: 12 }}>Service</span>
            <span style={{ fontWeight: 500 }}>{svc.name}</span>
          </div>
          <div className="sc-row" style={{ justifyContent: 'space-between' }}>
            <span className="sc-mute" style={{ fontSize: 12 }}>Barber</span>
            <span style={{ fontWeight: 500 }}>{stf.name}</span>
          </div>
          <div className="sc-row" style={{ justifyContent: 'space-between' }}>
            <span className="sc-mute" style={{ fontSize: 12 }}>When</span>
            <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>Wed May {picked.date} · {picked.time}</span>
          </div>
          <div className="sc-divider" style={{ margin: '4px 0' }} />
          <div className="sc-row" style={{ justifyContent: 'space-between' }}>
            <span className="sc-mute" style={{ fontSize: 12 }}>Total</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>${svc.price}</span>
          </div>
        </div>
      </div>
      <div>
        <label className="sc-label">Full name</label>
        <input className="sc-input" value={picked.name} onChange={(e) => onChange('name', e.target.value)} />
      </div>
      <div>
        <label className="sc-label">Phone</label>
        <input className="sc-input" value={picked.phone} onChange={(e) => onChange('phone', e.target.value)} />
        <div className="sc-helper">We'll text a reminder the day before.</div>
      </div>
      <div>
        <label className="sc-label">Email <span className="sc-mute">(optional)</span></label>
        <input className="sc-input" value={picked.email} onChange={(e) => onChange('email', e.target.value)} />
      </div>
    </div>
  );
}

function StepSuccess({ picked, svc, stf }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: 'color-mix(in oklab, var(--sc-brand) 12%, var(--sc-bg))',
        color: 'var(--sc-brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <WICC size={28} />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>You're booked</h3>
      <p className="sc-mute" style={{ fontSize: 13, margin: 0, marginBottom: 20, maxWidth: 280 }}>
        We've sent a confirmation to {picked.email || picked.phone}. See you soon, {picked.name.split(' ')[0]}.
      </p>
      <div className="sc-card" style={{ width: '100%', padding: 14, textAlign: 'left' }}>
        <div className="sc-stack" style={{ gap: 10 }}>
          <div className="sc-row" style={{ gap: 10 }}>
            <WICal size={16} className="sc-mute" />
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Wed May {picked.date} · {picked.time}</div>
              <div className="sc-mute" style={{ fontSize: 12 }}>{svc.name} · {svc.dur} min</div>
            </div>
          </div>
          <div className="sc-row" style={{ gap: 10 }}>
            <WIUser size={16} className="sc-mute" />
            <div style={{ fontSize: 14 }}>{stf.name}</div>
          </div>
          <div className="sc-row" style={{ gap: 10 }}>
            <WIPin size={16} className="sc-mute" />
            <div style={{ fontSize: 14 }}>412 Belmont Ave, Northside</div>
          </div>
        </div>
      </div>
      <p className="sc-mute" style={{ fontSize: 12, marginTop: 16 }}>Need to change? Reply to your text or call (415) 555-0140.</p>
    </div>
  );
}

Object.assign(window, { SCBookingWidget });
