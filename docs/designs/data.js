// Northside Barbers — mock data for ScheduleCore designs.

window.SC_DATA = (() => {
  const services = [
    { id: 's1', name: 'Classic haircut', dur: 30, price: 28, desc: 'Wash, cut, style.' },
    { id: 's2', name: 'Skin fade', dur: 45, price: 38, desc: 'Precision fade with line-up.' },
    { id: 's3', name: 'Beard trim', dur: 20, price: 18, desc: 'Shape and detail.' },
    { id: 's4', name: 'Hot towel shave', dur: 40, price: 42, desc: 'Straight razor, hot towel finish.' },
    { id: 's5', name: 'Cut + beard combo', dur: 50, price: 52, desc: 'Full reset.' },
    { id: 's6', name: 'Kids cut (under 12)', dur: 25, price: 22, desc: 'Patient and quick.' },
  ];

  const staff = [
    { id: 'b1', name: 'Marco Rossi',     role: 'Master barber',    initials: 'MR', cls: 'staff-1' },
    { id: 'b2', name: 'Jay Patel',       role: 'Senior barber',    initials: 'JP', cls: 'staff-2' },
    { id: 'b3', name: 'Lena Okafor',     role: 'Stylist',          initials: 'LO', cls: 'staff-3' },
    { id: 'b4', name: 'Sam Becker',      role: 'Apprentice',       initials: 'SB', cls: 'staff-4' },
  ];

  // 8am .. 7pm
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);

  // Week starts Mon May 4, 2026 — "today" is Wed May 6 to keep the now-line in view.
  const week = [
    { dow: 'Mon', date: 4 },
    { dow: 'Tue', date: 5 },
    { dow: 'Wed', date: 6, today: true },
    { dow: 'Thu', date: 7 },
    { dow: 'Fri', date: 8 },
    { dow: 'Sat', date: 9 },
    { dow: 'Sun', date: 10, closed: true },
  ];

  // Booking shape: { dayIdx, start (decimal hour), dur (min), staff, service, client, status? }
  const bookings = [
    // Mon
    { dayIdx: 0, start: 9.0,  dur: 30, staff: 'b1', service: 's1', client: 'Tom Reilly' },
    { dayIdx: 0, start: 10.0, dur: 45, staff: 'b1', service: 's2', client: 'Daniel Cho' },
    { dayIdx: 0, start: 9.5,  dur: 20, staff: 'b3', service: 's3', client: 'Aisha Khan' },
    { dayIdx: 0, start: 11.0, dur: 50, staff: 'b2', service: 's5', client: 'Owen Park' },
    { dayIdx: 0, start: 14.0, dur: 30, staff: 'b1', service: 's1', client: 'Henry Liu' },
    { dayIdx: 0, start: 15.5, dur: 40, staff: 'b3', service: 's4', client: 'Marcus Webb' },
    { dayIdx: 0, start: 16.5, dur: 25, staff: 'b4', service: 's6', client: 'Eli Forsberg' },
    // Tue
    { dayIdx: 1, start: 8.5,  dur: 30, staff: 'b2', service: 's1', client: 'Rafa Núñez' },
    { dayIdx: 1, start: 10.0, dur: 45, staff: 'b1', service: 's2', client: 'Will Edwards' },
    { dayIdx: 1, start: 11.5, dur: 20, staff: 'b4', service: 's3', client: 'Jordan Lee' },
    { dayIdx: 1, start: 13.0, dur: 50, staff: 'b1', service: 's5', client: 'Pete Brennan' },
    { dayIdx: 1, start: 14.5, dur: 30, staff: 'b3', service: 's1', client: 'Ade Olu' },
    { dayIdx: 1, start: 17.0, dur: 40, staff: 'b2', service: 's4', client: 'Nico Bertelli' },
    // Wed (today)
    { dayIdx: 2, start: 9.0,  dur: 30, staff: 'b1', service: 's1', client: 'James Carter' },
    { dayIdx: 2, start: 9.0,  dur: 45, staff: 'b2', service: 's2', client: 'Ravi Shah' },
    { dayIdx: 2, start: 10.0, dur: 25, staff: 'b4', service: 's6', client: 'Theo Marsh' },
    { dayIdx: 2, start: 10.5, dur: 50, staff: 'b1', service: 's5', client: 'Mike O\u2019Donnell' },
    { dayIdx: 2, start: 11.0, dur: 20, staff: 'b3', service: 's3', client: 'Yusuf Ahmed' },
    { dayIdx: 2, start: 13.5, dur: 40, staff: 'b2', service: 's4', client: 'Alex Romero' },
    { dayIdx: 2, start: 14.0, dur: 30, staff: 'b1', service: 's1', client: 'Chris Vale' },
    { dayIdx: 2, start: 15.0, dur: 45, staff: 'b3', service: 's2', client: 'Nate Brooks', status: 'cancelled' },
    { dayIdx: 2, start: 16.0, dur: 50, staff: 'b1', service: 's5', client: 'Devon Park' },
    // Thu
    { dayIdx: 3, start: 9.5,  dur: 30, staff: 'b2', service: 's1', client: 'Quinn Bauer' },
    { dayIdx: 3, start: 11.0, dur: 45, staff: 'b1', service: 's2', client: 'Kofi Boateng' },
    { dayIdx: 3, start: 13.0, dur: 20, staff: 'b3', service: 's3', client: 'Lior Stein' },
    { dayIdx: 3, start: 14.0, dur: 50, staff: 'b2', service: 's5', client: 'Sasha Wells' },
    { dayIdx: 3, start: 16.0, dur: 30, staff: 'b4', service: 's1', client: 'Beau Tran' },
    // Fri
    { dayIdx: 4, start: 8.5,  dur: 30, staff: 'b1', service: 's1', client: 'Dean Foster' },
    { dayIdx: 4, start: 9.0,  dur: 45, staff: 'b2', service: 's2', client: 'Hugo Bell' },
    { dayIdx: 4, start: 10.0, dur: 50, staff: 'b1', service: 's5', client: 'Ronan Kim' },
    { dayIdx: 4, start: 11.5, dur: 25, staff: 'b4', service: 's6', client: 'Caleb Yates' },
    { dayIdx: 4, start: 13.0, dur: 40, staff: 'b2', service: 's4', client: 'Vance Holm' },
    { dayIdx: 4, start: 14.5, dur: 30, staff: 'b3', service: 's1', client: 'Ezra Cole' },
    { dayIdx: 4, start: 15.5, dur: 45, staff: 'b1', service: 's2', client: 'Mateo Ruiz' },
    { dayIdx: 4, start: 17.0, dur: 50, staff: 'b2', service: 's5', client: 'Felix Andrade' },
    // Sat (busy)
    { dayIdx: 5, start: 9.0,  dur: 30, staff: 'b1', service: 's1', client: 'Joaquin Vidal' },
    { dayIdx: 5, start: 9.5,  dur: 45, staff: 'b2', service: 's2', client: 'Adrian Cole' },
    { dayIdx: 5, start: 10.0, dur: 20, staff: 'b3', service: 's3', client: 'Owen Bishop' },
    { dayIdx: 5, start: 10.5, dur: 25, staff: 'b4', service: 's6', client: 'Levi Stone' },
    { dayIdx: 5, start: 11.0, dur: 50, staff: 'b1', service: 's5', client: 'Niko Vega' },
    { dayIdx: 5, start: 12.0, dur: 30, staff: 'b3', service: 's1', client: 'Soren Lind' },
    { dayIdx: 5, start: 13.0, dur: 45, staff: 'b2', service: 's2', client: 'Kai Patel' },
    { dayIdx: 5, start: 14.0, dur: 40, staff: 'b1', service: 's4', client: 'Iggy Martin' },
    { dayIdx: 5, start: 15.0, dur: 30, staff: 'b3', service: 's1', client: 'Bruno Vega' },
  ];

  // Pre-resolve service/staff refs for convenience.
  const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  bookings.forEach((b) => { b.svc = serviceById[b.service]; b.stf = staffById[b.staff]; });

  // Available slots for the booking widget (Wed, Marco)
  const slotsMorning = ['08:30', '09:00', '09:30', '10:30', '11:00'];
  const slotsAfternoon = ['12:30', '13:00', '14:30', '15:30', '16:00', '17:00', '17:30'];
  const slotsBooked = new Set(['10:00', '11:30', '13:30', '14:00', '15:00', '16:30']);

  return {
    services, staff, hours, week, bookings,
    serviceById, staffById,
    slots: { morning: slotsMorning, afternoon: slotsAfternoon, booked: slotsBooked },
  };
})();
