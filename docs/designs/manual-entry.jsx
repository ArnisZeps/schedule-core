// Manual appointment entry — phone-call optimized.
// Three artboards: form panel only, panel-on-calendar (with backdrop),
// phone-sized variant.

const M_ICONS = window.SC_ICONS;
const MD = window.SC_DATA;

function SCManualEntry({ variant = 'panel' }) {
  const [client, setClient] = React.useState({
    mode: 'existing', // 'new' | 'existing'
    name: 'Daniel Cho',
    phone: '+1 (415) 555-0162',
    matched: true,
  });
  const [svcId, setSvc] = React.useState('s5');
  const [staffId, setStaff] = React.useState('b1');
  const [date] = React.useState('Wed, May 6, 2026');
  const [time, setTime] = React.useState('14:30');
  const [override, setOverride] = React.useState(false);
  const [notify, setNotify] = React.useState(true);
  const [notes, setNotes] = React.useState('Likes a #2 on the sides. Quick chat about beard product.');

  const svc = MD.serviceById[svcId];
  const stf = MD.staffById[staffId];

  // A few mock conflicts for the override hint
  const conflicts = svcId === 's5' && staffId === 'b1' && time === '14:30'
    ? [{ time: '14:00–14:30', client: 'Chris Vale', svc: 'Classic haircut' }]
    : [];

  const slots = ['08:30','09:00','09:30','10:30','11:00','12:30','13:00','14:30','15:30','16:00','17:00','17:30'];
  const taken = new Set(['10:00','11:30','13:30','14:00','15:00','16:30']);

  const isPhone = variant === 'phone';
  const padX = isPhone ? 14 : 20;
  return (
    <div className="sc-panel" style={{
      width: '100%', height: '100%', minHeight: 0, minWidth: 0,
      background: 'var(--sc-bg)', color: 'var(--sc-fg)',
      display: 'flex', flexDirection: 'column',
      borderLeft: variant === 'over-cal' ? '1px solid var(--sc-border)' : 'none',
    }}>
      <div style={{
        padding: `14px ${padX}px`, borderBottom: '1px solid var(--sc-border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div className="sc-row" style={{ gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--sc-muted)', color: 'var(--sc-fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <M_ICONS.Phone size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>New appointment</h2>
              <div className="sc-mute" style={{ fontSize: 12 }}>Phone booking · taken by Eli</div>
            </div>
          </div>
        </div>
        <button className="sc-btn sc-btn-ghost sc-btn-icon-sm" aria-label="Close"><M_ICONS.X size={14} /></button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `14px ${padX}px` }}>
        {/* Client */}
        <div className="sc-mute" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Client</div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: 10, color: 'var(--sc-muted-fg)' }}>
            <M_ICONS.Search size={14} />
          </div>
          <input className="sc-input" value={client.name}
                 placeholder="Search by name or phone…"
                 onChange={(e) => setClient({ ...client, name: e.target.value })}
                 style={{ paddingLeft: 32 }} />
          {client.matched && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: 'var(--sc-popover)', border: '1px solid var(--sc-border)',
              borderRadius: 8, boxShadow: 'var(--sc-shadow-md)', padding: 4, zIndex: 2,
              display: 'none', // shown only on the open-popover variant
            }}>
            </div>
          )}
        </div>
        {client.matched && (
          <div className="sc-row" style={{ marginTop: 8, padding: '10px 12px', background: 'var(--sc-subtle)', borderRadius: 8, gap: 10 }}>
            <div className="sc-avatar" style={{ width: 32, height: 32 }}>DC</div>
            <div className="sc-grow" style={{ minWidth: 0 }}>
              <div className="sc-row" style={{ gap: 6 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Daniel Cho</span>
                <span className="sc-badge sc-badge-outline">Returning · 4 visits</span>
              </div>
              <div className="sc-mute" style={{ fontSize: 12, marginTop: 2 }}>+1 (415) 555-0162 · Last visit Apr 12</div>
            </div>
            <button className="sc-btn sc-btn-ghost sc-btn-sm">Change</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <label className="sc-label" style={{ fontSize: 12 }}>Phone <span className="sc-mute">·required</span></label>
            <input className="sc-input" value={client.phone}
                   onChange={(e) => setClient({ ...client, phone: e.target.value })} />
          </div>
          <div>
            <label className="sc-label" style={{ fontSize: 12 }}>Email <span className="sc-mute">·optional</span></label>
            <input className="sc-input" placeholder="—" />
          </div>
        </div>

        <div className="sc-divider" />

        {/* Service */}
        <div className="sc-mute" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Service</div>
        <select className="sc-select" value={svcId} onChange={(e) => setSvc(e.target.value)}
                style={{ appearance: 'auto' }}>
          {MD.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name} · {s.dur} min · ${s.price}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {MD.services.slice(0, 4).map((s) => (
            <button key={s.id}
                    onClick={() => setSvc(s.id)}
                    className={`sc-badge ${svcId === s.id ? 'sc-badge-brand' : 'sc-badge-outline'}`}
                    style={{ cursor: 'pointer', height: 24 }}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="sc-divider" />

        {/* Staff + date + time */}
        <div className="sc-mute" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>With</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {MD.staff.map((s) => (
            <button key={s.id}
                    onClick={() => setStaff(s.id)}
                    className={`sc-tile ${staffId === s.id ? 'selected' : ''}`}
                    style={{ padding: 8, gap: 8 }}>
              <div className="sc-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{s.initials}</div>
              <div className="sc-tile-main">
                <div className="sc-tile-title" style={{ fontSize: 13 }}>{s.name.split(' ')[0]}</div>
                <div className="sc-tile-meta" style={{ fontSize: 11 }}>{s.role}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="sc-divider" />

        <div className="sc-mute" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>When</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 4px 0 12px', height: 36,
          border: '1px solid var(--sc-input)', borderRadius: 'var(--sc-radius-sm)',
          background: 'var(--sc-bg)', marginBottom: 10,
        }}>
          <M_ICONS.Calendar size={14} className="sc-mute" />
          <span style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{date}</span>
          <button className="sc-btn sc-btn-ghost sc-btn-xs" style={{ flexShrink: 0 }}>Change</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {slots.map((t) => {
            const isTaken = taken.has(t);
            const sel = time === t;
            return (
              <button key={t}
                      onClick={() => !isTaken || override ? setTime(t) : null}
                      className={`sc-slot ${sel ? 'selected' : ''} ${isTaken && !override ? 'disabled' : ''}`}
                      style={{ height: 32, fontSize: 12 }}>
                {t}
              </button>
            );
          })}
        </div>
        <label className="sc-row" style={{ marginTop: 10, gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Override availability <span className="sc-mute">(allow double-booking)</span></span>
        </label>

        {conflicts.length > 0 && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8,
            background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
            fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
            <div>
              <strong>Time conflict.</strong> {stf.name} has {conflicts[0].svc} ({conflicts[0].client}) at {conflicts[0].time}, which overlaps a {svc.dur}-min booking starting at {time}.
              {!override && <> Tick override to book anyway.</>}
            </div>
          </div>
        )}

        <div className="sc-divider" />

        <div className="sc-mute" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Notes <span style={{ textTransform: 'none', fontWeight: 400 }} className="sc-mute">(internal)</span></div>
        <textarea className="sc-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ minHeight: 60 }} />

        <label className="sc-row" style={{ marginTop: 12, gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Send confirmation SMS to client</span>
        </label>
      </div>

      {/* Footer summary + actions */}
      <div style={{
        padding: `12px ${padX}px`, borderTop: '1px solid var(--sc-border)',
        background: 'var(--sc-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }} className="sc-truncate">
            {svc.name} · {stf.name.split(' ')[0]} · {time}
          </div>
          <div className="sc-mute sc-truncate" style={{ fontSize: 12 }}>
            {svc.dur} min · ${svc.price}
          </div>
        </div>
        <div className="sc-row" style={{ gap: 8 }}>
          <button className="sc-btn sc-btn-ghost sc-btn-sm">Cancel</button>
          <button className="sc-btn sc-btn-primary sc-btn-sm">Book appointment</button>
        </div>
      </div>
    </div>
  );
}

// Calendar with the manual-entry slide-over open on top
function SCCalendarWithEntry() {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <SCWeekCalendar />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(2px)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <div style={{
          width: 480, height: '100%',
          boxShadow: '-12px 0 40px rgba(0,0,0,.18)',
          position: 'relative', zIndex: 1,
        }}>
          <SCManualEntry variant="over-cal" />
        </div>
      </div>
    </div>
  );
}

// Phone-sized variant — full screen, scroll
function SCPhoneManualEntry() {
  return (
    <div data-theme="light" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--sc-bg)', color: 'var(--sc-fg)',
      fontFamily: 'var(--sc-font)',
      overflow: 'hidden',
    }}>
      <div className="sc-phone-notch" />
      <div className="sc-phone-statusbar" style={{ paddingTop: 12 }}>
        <span>9:41</span>
        <span style={{ display: 'inline-flex', gap: 4, fontSize: 10 }}>
          <span>●●●●</span><span>WiFi</span><span>100%</span>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <SCManualEntry variant="phone" />
      </div>
    </div>
  );
}

Object.assign(window, { SCManualEntry, SCCalendarWithEntry, SCPhoneManualEntry });
