// Owner dashboard surfaces for ScheduleCore.
// Exports: SCShell, SCWeekCalendar (v1 + v2 via prop), SCAgendaList,
// SCServicesScreen, SCStaffScreen, SCAvailabilityScreen,
// SCPhoneCalendar, SCPhoneAgenda.

const { Calendar: ICal, List: IList, Users: IUsers, Scissors: IScis, Clock: IClock,
        Settings: ISet, Plus: IPlus, ChevL, ChevR, ChevD, Search: ISearch, Bell: IBell,
        More: IMore, User: IUser, LayoutDashboard: IDash, Filter: IFil, Briefcase: IBag,
        ArrowR, MapPin: IPin, Edit: IEdit, Home: IHome } = window.SC_ICONS;

const D = window.SC_DATA;

// ── Shared shell ────────────────────────────────────────────────────────
function SCShell({ active = 'calendar', children, title, actions, mobile = false }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IDash },
    { id: 'calendar', label: 'Calendar', icon: ICal },
    { id: 'appointments', label: 'Appointments', icon: IList },
    { id: 'clients', label: 'Clients', icon: IUsers },
  ];
  const cfgItems = [
    { id: 'services', label: 'Services', icon: IScis },
    { id: 'staff', label: 'Staff', icon: IUser },
    { id: 'hours', label: 'Hours & availability', icon: IClock },
    { id: 'settings', label: 'Settings', icon: ISet },
  ];
  return (
    <div className={`sc-shell ${mobile ? 'sc-shell-mobile' : ''}`}>
      {!mobile && (
        <aside className="sc-sidebar">
          <div className="sc-sidebar-brand">
            <div className="sc-brandmark">N</div>
            <div>
              <div className="sc-sidebar-name">Northside Barbers</div>
              <div className="sc-sidebar-tag">on ScheduleCore</div>
            </div>
          </div>
          <div className="sc-sidebar-section">Workspace</div>
          <nav className="sc-nav">
            {navItems.map((it) => (
              <a key={it.id} className={`sc-nav-item ${it.id === active ? 'active' : ''}`}>
                <it.icon className="sc-nav-icon" />
                {it.label}
              </a>
            ))}
          </nav>
          <div className="sc-sidebar-section">Configuration</div>
          <nav className="sc-nav">
            {cfgItems.map((it) => (
              <a key={it.id} className={`sc-nav-item ${it.id === active ? 'active' : ''}`}>
                <it.icon className="sc-nav-icon" />
                {it.label}
              </a>
            ))}
          </nav>
          <div className="sc-sidebar-footer">
            <div className="sc-avatar">EM</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }} className="sc-truncate">Eli Marsh</div>
              <div style={{ fontSize: 11 }} className="sc-mute sc-truncate">Owner</div>
            </div>
            <ChevD size={14} className="sc-mute" />
          </div>
        </aside>
      )}
      <main className="sc-main">
        <header className="sc-topbar">
          <div className="sc-topbar-left">
            {mobile && (
              <button className="sc-btn sc-btn-ghost sc-btn-icon" aria-label="Menu">
                <IList size={18} />
              </button>
            )}
            <h1>{title}</h1>
          </div>
          <div className="sc-topbar-actions">{actions}</div>
        </header>
        <div className="sc-content">{children}</div>
      </main>
    </div>
  );
}

// ── Calendar event positioning helpers ─────────────────────────────────
function evtTop(start, hourStart = 8) {
  return (start - hourStart) * 56;
}
function evtHeight(dur) { return (dur / 60) * 56 - 2; }
function fmtHour(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh} ${ap}`;
}
function fmtTime(h) {
  const hr = Math.floor(h);
  const mn = Math.round((h - hr) * 60);
  const ap = hr >= 12 ? 'pm' : 'am';
  let hh = hr % 12; if (hh === 0) hh = 12;
  return `${hh}:${mn.toString().padStart(2, '0')}${ap}`;
}

// ── v1: Week × Day grid (time-grouped) ─────────────────────────────────
function SCWeekCalendar({ variant = 'time', empty = false, busyState = false }) {
  const days = D.week;
  const allBookings = empty ? [] : D.bookings;
  const todayIdx = days.findIndex((d) => d.today);

  return (
    <div className="sc-cal">
      <div className="sc-cal-toolbar">
        <div className="sc-cal-title">
          <button className="sc-btn sc-btn-outline sc-btn-sm">Today</button>
          <div className="sc-cal-nav">
            <button className="sc-btn sc-btn-ghost sc-btn-icon-sm" aria-label="Prev"><ChevL /></button>
            <button className="sc-btn sc-btn-ghost sc-btn-icon-sm" aria-label="Next"><ChevR /></button>
          </div>
          <h2>May 4 – 10, 2026</h2>
        </div>
        <div className="sc-row" style={{ gap: 8 }}>
          <div className="sc-segment">
            <button>Day</button>
            <button className="active">Week</button>
            <button>Agenda</button>
          </div>
          <button className="sc-btn sc-btn-outline sc-btn-sm">
            <IFil size={14} /> All staff
          </button>
        </div>
      </div>

      <div className="sc-week" style={{ flex: 1 }}>
        <div className="sc-week-head">
          <div />
          {days.map((d, i) => (
            <div key={i} className={`sc-day ${d.today ? 'today' : ''}`}>
              <span className="sc-daynum">{d.date}</span>
              <span>{d.dow}{d.closed ? ' · Closed' : ''}</span>
            </div>
          ))}
        </div>
        <div className="sc-week-gutter">
          {D.hours.map((h) => (
            <div key={h} className="sc-hour-label">{fmtHour(h)}</div>
          ))}
        </div>
        {days.map((d, dIdx) => (
          <div key={dIdx} className="sc-week-day">
            {D.hours.map((h, hi) => (
              <div key={hi} className="sc-hour-cell" />
            ))}
            {dIdx === todayIdx && !empty && (
              <div className="sc-now-line" style={{ top: evtTop(10.4) }} />
            )}
            {allBookings.filter((b) => b.dayIdx === dIdx).map((b, i) => (
              <div key={i}
                className={`sc-evt ${b.stf.cls} ${b.status === 'cancelled' ? 'cancelled' : ''}`}
                style={{ top: evtTop(b.start), height: evtHeight(b.dur) }}>
                <div className="sc-evt-time">{fmtTime(b.start)} · {b.svc.dur}m</div>
                <div className="sc-evt-title sc-truncate">{b.svc.name}</div>
                <div className="sc-evt-meta sc-truncate">{b.client} · {b.stf.initials}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── v2: Resource (staff) rows × time columns ──────────────────────────
function SCResourceCalendar() {
  const hourCols = D.hours; // 11 hour columns
  return (
    <div className="sc-cal">
      <div className="sc-cal-toolbar">
        <div className="sc-cal-title">
          <button className="sc-btn sc-btn-outline sc-btn-sm">Today</button>
          <div className="sc-cal-nav">
            <button className="sc-btn sc-btn-ghost sc-btn-icon-sm"><ChevL /></button>
            <button className="sc-btn sc-btn-ghost sc-btn-icon-sm"><ChevR /></button>
          </div>
          <h2>Wednesday, May 6</h2>
        </div>
        <div className="sc-row" style={{ gap: 8 }}>
          <div className="sc-segment">
            <button className="active">Day</button>
            <button>Week</button>
            <button>Agenda</button>
          </div>
          <button className="sc-btn sc-btn-primary sc-btn-sm">
            <IPlus size={14} /> New appointment
          </button>
        </div>
      </div>

      <div className="sc-resgrid" style={{ flex: 1 }}>
        <div className="sc-resrow-head">
          <div className="sc-resstaff" style={{ background: 'transparent' }}>
            <span className="sc-mute" style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>Barbers</span>
          </div>
          {hourCols.map((h) => (
            <div key={h} className="sc-restime">{fmtHour(h)}</div>
          ))}
        </div>
        {D.staff.map((s) => (
          <div key={s.id} className="sc-resrow">
            <div className="sc-resstaff">
              <div className={`sc-avatar`} style={{ background: `var(--sc-muted)` }}>{s.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="sc-resstaff-name sc-truncate">{s.name}</div>
                <div className="sc-resstaff-role">{s.role}</div>
              </div>
            </div>
            {/* tracks */}
            {hourCols.map((h, i) => (
              <div key={i} className="sc-restrack" />
            ))}
            {/* events overlaid on the right area */}
            <div className="sc-restrack-area" style={{ position: 'absolute', left: 160, right: 0, top: 0, bottom: 0 }}>
              {D.bookings.filter((b) => b.dayIdx === 2 && b.staff === s.id).map((b, i) => {
                const colW = 100 / hourCols.length;
                const left = ((b.start - 8) / hourCols.length) * 100;
                const width = ((b.dur / 60) / hourCols.length) * 100;
                return (
                  <div key={i}
                    className={`sc-evt ${s.cls} ${b.status === 'cancelled' ? 'cancelled' : ''}`}
                    style={{
                      position: 'absolute', top: 8, height: 64,
                      left: `calc(${left}% + 4px)`, width: `calc(${width}% - 8px)`,
                    }}>
                    <div className="sc-evt-time">{fmtTime(b.start)} · {b.svc.dur}m</div>
                    <div className="sc-evt-title sc-truncate">{b.svc.name}</div>
                    <div className="sc-evt-meta sc-truncate">{b.client}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agenda list ─────────────────────────────────────────────────────────
function SCAgendaList({ phone = false }) {
  const groups = [
    { date: 'Today, Wed May 6', items: D.bookings.filter((b) => b.dayIdx === 2) },
    { date: 'Tomorrow, Thu May 7', items: D.bookings.filter((b) => b.dayIdx === 3) },
    { date: 'Fri, May 8', items: D.bookings.filter((b) => b.dayIdx === 4) },
  ];
  return (
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          <div className="sc-agenda-day">
            <h3>{g.date}</h3>
            <span>{g.items.length} appointment{g.items.length === 1 ? '' : 's'}</span>
          </div>
          {g.items.sort((a, b) => a.start - b.start).map((b, i) => (
            <div key={i} className="sc-agenda-row">
              <div className="sc-agenda-time">
                {fmtTime(b.start)}
                <small>{b.svc.dur} min</small>
              </div>
              <div className="sc-agenda-bar" style={{ background: `var(--sc-fg)`, opacity: b.status === 'cancelled' ? .3 : 1 }} />
              <div className="sc-agenda-main">
                <div className="sc-agenda-svc">{b.svc.name}</div>
                <div className="sc-agenda-meta">
                  <span>{b.client}</span>
                  <span>·</span>
                  <span>{b.stf.name}</span>
                  {b.status === 'cancelled' && <span className="sc-badge sc-badge-destructive">Cancelled</span>}
                </div>
              </div>
              {!phone && (
                <div className="sc-row" style={{ gap: 4 }}>
                  <span className="sc-badge sc-badge-outline">${b.svc.price}</span>
                  <button className="sc-btn sc-btn-ghost sc-btn-icon-sm" aria-label="More"><IMore size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Services screen ────────────────────────────────────────────────────
function SCServicesScreen() {
  return (
    <div className="sc-content-pad">
      <div className="sc-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 2 }}>Services</h2>
          <p className="sc-mute" style={{ fontSize: 13, margin: 0 }}>What clients can book.</p>
        </div>
        <button className="sc-btn sc-btn-primary sc-btn-sm"><IPlus size={14} /> New service</button>
      </div>
      <div className="sc-card">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Service</th>
              <th style={{ width: 110 }}>Duration</th>
              <th style={{ width: 100 }}>Price</th>
              <th style={{ width: 180 }}>Staff</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {D.services.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div className="sc-mute" style={{ fontSize: 12 }}>{s.desc}</div>
                </td>
                <td><span className="sc-badge sc-badge-outline">{s.dur} min</span></td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>${s.price}</td>
                <td>
                  <div style={{ display: 'flex', marginLeft: 4 }}>
                    {D.staff.slice(0, 4).map((p, i) => (
                      <div key={p.id} className="sc-avatar"
                           style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid var(--sc-bg)', fontSize: 10 }}>
                        {p.initials}
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="sc-btn sc-btn-ghost sc-btn-icon-sm" aria-label="More"><IMore size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Staff screen ──────────────────────────────────────────────────────
function SCStaffScreen() {
  return (
    <div className="sc-content-pad">
      <div className="sc-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 2 }}>Staff</h2>
          <p className="sc-mute" style={{ fontSize: 13, margin: 0 }}>People who provide services.</p>
        </div>
        <button className="sc-btn sc-btn-primary sc-btn-sm"><IPlus size={14} /> Invite staff</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {D.staff.map((s) => (
          <div key={s.id} className="sc-card">
            <div className="sc-card-body" style={{ padding: 16 }}>
              <div className="sc-row" style={{ marginBottom: 12 }}>
                <div className="sc-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{s.initials}</div>
                <div className="sc-grow">
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="sc-mute" style={{ fontSize: 12 }}>{s.role}</div>
                </div>
                <button className="sc-btn sc-btn-ghost sc-btn-icon-sm"><IMore size={14} /></button>
              </div>
              <div className="sc-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="sc-badge sc-badge-success">Active</span>
                <span className="sc-badge sc-badge-outline">{Math.floor(Math.random() * 30 + 12)} bookings · 7d</span>
              </div>
              <div className="sc-divider" />
              <div className="sc-mute" style={{ fontSize: 12, marginBottom: 6 }}>Provides</div>
              <div className="sc-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {D.services.slice(0, 4).map((sv) => (
                  <span key={sv.id} className="sc-badge sc-badge-outline">{sv.name}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Availability screen ──────────────────────────────────────────────
function SCAvailabilityScreen() {
  const days = [
    { d: 'Monday', open: '08:00', close: '19:00', enabled: true },
    { d: 'Tuesday', open: '08:00', close: '19:00', enabled: true },
    { d: 'Wednesday', open: '08:00', close: '19:00', enabled: true },
    { d: 'Thursday', open: '08:00', close: '19:00', enabled: true },
    { d: 'Friday', open: '08:00', close: '20:00', enabled: true },
    { d: 'Saturday', open: '09:00', close: '17:00', enabled: true },
    { d: 'Sunday', open: '—', close: '—', enabled: false },
  ];
  return (
    <div className="sc-content-pad">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 2 }}>Hours & availability</h2>
        <p className="sc-mute" style={{ fontSize: 13, margin: 0 }}>Default working hours apply to all staff. Override per person under Staff.</p>
      </div>
      <div className="sc-card">
        <div className="sc-card-header">
          <div className="sc-card-title">Default working hours</div>
          <div className="sc-card-desc">Times your shop is open for new bookings.</div>
        </div>
        <div className="sc-card-body" style={{ padding: 0 }}>
          {days.map((d, i) => (
            <div key={i} className="sc-row"
                 style={{ padding: '12px 20px', borderTop: i ? '1px solid var(--sc-border)' : 0, gap: 16 }}>
              <label className="sc-row" style={{ width: 130, gap: 8 }}>
                <span className="sc-toggle" style={{
                  display: 'inline-block', width: 32, height: 18, borderRadius: 999,
                  background: d.enabled ? 'var(--sc-brand)' : 'var(--sc-border)', position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: d.enabled ? 16 : 2,
                    width: 14, height: 14, borderRadius: 999, background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                  }} />
                </span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{d.d}</span>
              </label>
              {d.enabled ? (
                <div className="sc-row" style={{ gap: 8 }}>
                  <div className="sc-input" style={{ width: 96, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{d.open}</div>
                  <span className="sc-mute">to</span>
                  <div className="sc-input" style={{ width: 96, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{d.close}</div>
                  <button className="sc-btn sc-btn-ghost sc-btn-sm">+ Add break</button>
                </div>
              ) : (
                <span className="sc-mute" style={{ fontSize: 13 }}>Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="sc-card" style={{ marginTop: 16 }}>
        <div className="sc-card-header">
          <div className="sc-card-title">Time off & blackout dates</div>
          <div className="sc-card-desc">Holidays and shop-wide closures.</div>
        </div>
        <div className="sc-card-body">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="sc-badge sc-badge-outline">May 25 — Public holiday</span>
            <span className="sc-badge sc-badge-outline">Jul 4 — Public holiday</span>
            <button className="sc-btn sc-btn-outline sc-btn-sm"><IPlus size={14} /> Add date</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phone-sized variants ──────────────────────────────────────────────
function SCPhoneStatusBar() {
  return (
    <>
      <div className="sc-phone-notch" />
      <div className="sc-phone-statusbar">
        <span>9:41</span>
        <span style={{ display: 'inline-flex', gap: 4, fontSize: 10 }}>
          <span>●●●●</span>
          <span>WiFi</span>
          <span>100%</span>
        </span>
      </div>
    </>
  );
}

function SCPhoneAgenda() {
  const today = D.bookings.filter((b) => b.dayIdx === 2).sort((a, b) => a.start - b.start);
  return (
    <div className="sc-surface" data-theme="light" style={{ display: 'flex', flexDirection: 'column' }}>
      <SCPhoneStatusBar />
      <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="sc-mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>Today</div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Wed, May 6</h2>
        </div>
        <button className="sc-btn sc-btn-primary sc-btn-icon" aria-label="New"><IPlus size={16} /></button>
      </div>
      <div className="sc-segment" style={{ margin: '0 16px 8px', alignSelf: 'stretch' }}>
        <button>Day</button>
        <button className="active">Agenda</button>
        <button>Staff</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {today.map((b, i) => (
          <div key={i} className="sc-agenda-row" style={{ padding: '10px 16px', gridTemplateColumns: '64px 3px 1fr' }}>
            <div className="sc-agenda-time" style={{ fontSize: 12 }}>
              {fmtTime(b.start)}
              <small>{b.svc.dur}m</small>
            </div>
            <div className="sc-agenda-bar" />
            <div className="sc-agenda-main">
              <div className="sc-agenda-svc" style={{ fontSize: 13 }}>{b.svc.name}</div>
              <div className="sc-agenda-meta">{b.client} · {b.stf.initials}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="sc-tabbar">
        {[
          { l: 'Today', i: IHome, a: true },
          { l: 'Calendar', i: ICal },
          { l: 'Clients', i: IUsers },
          { l: 'More', i: IMore },
        ].map((t, i) => (
          <div key={i} className={`sc-tabbar-item ${t.a ? 'active' : ''}`}>
            <t.i size={20} /> {t.l}
          </div>
        ))}
      </div>
    </div>
  );
}

function SCPhoneCalendar() {
  // Single-day vertical list with hour ruler — most usable on phone
  const today = D.bookings.filter((b) => b.dayIdx === 2);
  return (
    <div className="sc-surface" data-theme="light" style={{ display: 'flex', flexDirection: 'column' }}>
      <SCPhoneStatusBar />
      <div style={{ padding: '4px 16px 8px' }}>
        <div className="sc-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Calendar</h2>
          <button className="sc-btn sc-btn-ghost sc-btn-icon-sm"><ISearch /></button>
        </div>
        <div className="sc-row" style={{ marginTop: 8, gap: 6, overflow: 'auto' }}>
          {D.week.map((d, i) => (
            <div key={i} className={`sc-datechip ${d.today ? 'selected' : ''}`}
                 style={{ minWidth: 44, padding: '6px 4px' }}>
              <span className="sc-dow">{d.dow.slice(0, 1)}</span>
              <span className="sc-dnum" style={{ fontSize: 14 }}>{d.date}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: '40px 1fr', position: 'relative' }}>
        {D.hours.map((h, i) => (
          <React.Fragment key={i}>
            <div style={{ height: 56, padding: '4px 6px', fontSize: 10, color: 'var(--sc-muted-fg)', fontFamily: 'var(--sc-mono)', textAlign: 'right', transform: 'translateY(-6px)' }}>{fmtHour(h)}</div>
            <div style={{ height: 56, borderBottom: '1px solid var(--sc-border)', borderLeft: '1px solid var(--sc-border)' }} />
          </React.Fragment>
        ))}
        <div style={{ position: 'absolute', left: 40, right: 8, top: 0, bottom: 0, pointerEvents: 'none' }}>
          {today.map((b, i) => (
            <div key={i} className={`sc-evt ${b.stf.cls}`}
                 style={{ position: 'absolute', left: 4, right: 4, top: evtTop(b.start), height: evtHeight(b.dur), pointerEvents: 'auto' }}>
              <div className="sc-evt-time">{fmtTime(b.start)}</div>
              <div className="sc-evt-title sc-truncate">{b.svc.name}</div>
              <div className="sc-evt-meta sc-truncate">{b.client}</div>
            </div>
          ))}
          <div className="sc-now-line" style={{ top: evtTop(10.4), left: -4, right: 0 }} />
        </div>
      </div>
      <div className="sc-tabbar">
        {[
          { l: 'Today', i: IHome },
          { l: 'Calendar', i: ICal, a: true },
          { l: 'Clients', i: IUsers },
          { l: 'More', i: IMore },
        ].map((t, i) => (
          <div key={i} className={`sc-tabbar-item ${t.a ? 'active' : ''}`}>
            <t.i size={20} /> {t.l}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  SCShell, SCWeekCalendar, SCResourceCalendar, SCAgendaList,
  SCServicesScreen, SCStaffScreen, SCAvailabilityScreen,
  SCPhoneAgenda, SCPhoneCalendar,
});
