// App entry: builds the DesignCanvas with all surfaces + Tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brand": "#0f172a",
  "density": "regular",
  "theme": "light",
  "state": "busy"
}/*EDITMODE-END*/;

const themes = {
  light: { brand: '#0f172a' },
  dark:  { brand: '#fafafa' },
};

function ThemedSurface({ theme, density, brand, mode = 'desktop', children, height }) {
  const styleVars = brand
    ? { '--sc-brand': brand, '--sc-brand-fg': isDark(brand) ? '#fff' : '#0a0a0a' }
    : {};
  return (
    <div className="sc-surface" data-theme={theme} data-density={density} style={styleVars}>
      {children}
    </div>
  );
}

function isDark(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.6;
}

function PhoneFrame({ children }) {
  return (
    <div className="sc-phone-shell">
      <div className="sc-phone-screen">{children}</div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const W = (children, props = {}) => (
    <ThemedSurface theme={t.theme} density={t.density} brand={t.brand} {...props}>{children}</ThemedSurface>
  );

  // Topbar action sets reused across artboards
  const calendarActions = (
    <>
      <div className="sc-row" style={{ background: 'var(--sc-muted)', borderRadius: 6, padding: '0 8px', height: 32, gap: 6 }}>
        <span className="sc-mute" style={{ fontSize: 12 }}>⌘K</span>
        <span style={{ fontSize: 12 }} className="sc-mute">Search clients…</span>
      </div>
      <button className="sc-btn sc-btn-ghost sc-btn-icon"><window.SC_ICONS.Bell size={16} /></button>
      <button className="sc-btn sc-btn-primary sc-btn-sm">
        <window.SC_ICONS.Plus size={14} /> New appointment
      </button>
    </>
  );

  return (
    <>
      <DesignCanvas>
        <DCSection id="dashboard-calendar" title="Owner dashboard — Calendar (M5b)"
                   subtitle="Two takes on the week view, plus the agenda list and the responsive phone surface.">
          <DCArtboard id="cal-week" label="A · Week × Day grid (default)" width={1280} height={820}>
            {W(
              <SCShell active="calendar" title="Calendar" actions={calendarActions}>
                <SCWeekCalendar />
              </SCShell>
            )}
          </DCArtboard>
          <DCArtboard id="cal-resource" label="B · Resource lanes (per-staff day view)" width={1280} height={820}>
            {W(
              <SCShell active="calendar" title="Calendar" actions={calendarActions}>
                <SCResourceCalendar />
              </SCShell>
            )}
          </DCArtboard>
          <DCArtboard id="cal-agenda" label="C · Appointment list" width={900} height={820}>
            {W(
              <SCShell active="appointments" title="Appointments"
                actions={
                  <>
                    <button className="sc-btn sc-btn-outline sc-btn-sm">
                      <window.SC_ICONS.Filter size={14} /> Filter
                    </button>
                    <button className="sc-btn sc-btn-primary sc-btn-sm">
                      <window.SC_ICONS.Plus size={14} /> New
                    </button>
                  </>
                }>
                <SCAgendaList />
              </SCShell>
            )}
          </DCArtboard>
          <DCArtboard id="cal-phone-agenda" label="D · Phone — agenda" width={360} height={760}>
            <PhoneFrame>{W(<SCPhoneAgenda />)}</PhoneFrame>
          </DCArtboard>
          <DCArtboard id="cal-phone-day" label="E · Phone — day timeline" width={360} height={760}>
            <PhoneFrame>{W(<SCPhoneCalendar />)}</PhoneFrame>
          </DCArtboard>
        </DCSection>

        <DCSection id="dashboard-config" title="Owner dashboard — Configuration (M5a context)"
                   subtitle="Services, staff, and availability — the foundation business owners set up first.">
          <DCArtboard id="cfg-services" label="Services catalog" width={1100} height={720}>
            {W(
              <SCShell active="services" title="Services">
                <SCServicesScreen />
              </SCShell>
            )}
          </DCArtboard>
          <DCArtboard id="cfg-staff" label="Staff" width={1100} height={720}>
            {W(
              <SCShell active="staff" title="Staff">
                <SCStaffScreen />
              </SCShell>
            )}
          </DCArtboard>
          <DCArtboard id="cfg-hours" label="Hours & availability" width={1100} height={780}>
            {W(
              <SCShell active="hours" title="Hours & availability">
                <SCAvailabilityScreen />
              </SCShell>
            )}
          </DCArtboard>
        </DCSection>

        <DCSection id="widget" title="Client booking widget (M7)"
                   subtitle="Wizard: service → barber → date → time → details → success. No client account required.">
          <DCArtboard id="w-1" label="1 · Service" width={420} height={720}>
            {W(<SCBookingWidget initialStep={0} />)}
          </DCArtboard>
          <DCArtboard id="w-2" label="2 · Barber" width={420} height={720}>
            {W(<SCBookingWidget initialStep={1} />)}
          </DCArtboard>
          <DCArtboard id="w-3" label="3 · Date" width={420} height={720}>
            {W(<SCBookingWidget initialStep={2} />)}
          </DCArtboard>
          <DCArtboard id="w-4" label="4 · Time" width={420} height={720}>
            {W(<SCBookingWidget initialStep={3} />)}
          </DCArtboard>
          <DCArtboard id="w-5" label="5 · Confirm" width={420} height={720}>
            {W(<SCBookingWidget initialStep={4} />)}
          </DCArtboard>
          <DCArtboard id="w-6" label="6 · Success" width={420} height={720}>
            {W(<SCBookingWidget initialStep={5} />)}
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="ScheduleCore tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.brand}
                    onChange={(v) => setTweak('brand', v)} />
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme}
                    options={['light', 'dark']}
                    onChange={(v) => setTweak('theme', v)} />
        <TweakRadio label="Density" value={t.density}
                    options={['compact', 'regular', 'comfy']}
                    onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Quick palette" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['Slate',  '#0f172a'],
            ['Indigo', '#4f46e5'],
            ['Emerald','#059669'],
            ['Rose',   '#e11d48'],
            ['Amber',  '#d97706'],
            ['Violet', '#7c3aed'],
          ].map(([l, c]) => (
            <button key={c} onClick={() => setTweak('brand', c)}
              title={l}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: c, border: '1.5px solid rgba(0,0,0,.1)',
                cursor: 'pointer', boxShadow: t.brand === c ? '0 0 0 2px var(--sc-fg)' : 'none',
              }} />
          ))}
        </div>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
