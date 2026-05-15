'use client'

import { useState, useEffect, useRef } from 'react'
import { usePublicServices, usePublicStaff, useCreatePublicBooking } from '@/hooks/usePublicBooking'
import type { PublicLocation, PublicService, PublicStaffMember, PublicSlot, PublicBookingResult } from '@/hooks/usePublicBooking'
import { LocationSection } from './LocationSection'
import { ServiceSection } from './ServiceSection'
import { StaffSection } from './StaffSection'
import { DateTimeSection } from './DateTimeSection'
import { DetailsSection } from './DetailsSection'
import type { DetailsFormValues } from './DetailsSection'
import { BookingConfirmation } from './BookingConfirmation'
import { FloatingNav } from './FloatingNav'

interface Props {
  tenantSlug: string
  tenantName: string
  initialLocations: PublicLocation[]
  initialServices: PublicService[]
  initialStaffByService: Record<string, PublicStaffMember[]>
}

const SECTION_IDS = {
  location: 'section-location',
  service: 'section-service',
  staff: 'section-staff',
  datetime: 'section-datetime',
}

export function BookingWidget({ tenantSlug, tenantName, initialLocations, initialServices, initialStaffByService }: Props) {
  const isMultiLocation = initialLocations.length > 1

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    isMultiLocation ? null : (initialLocations[0]?.id ?? null),
  )
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'any' | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null)
  const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const staffInitialData = selectedServiceId ? initialStaffByService[selectedServiceId] : undefined

  const { data: services = [], isLoading: servicesLoading } = usePublicServices(
    tenantSlug,
    initialServices.length > 0 ? initialServices : undefined,
  )
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null
  const { data: staff = [], isLoading: staffLoading } = usePublicStaff(
    tenantSlug,
    selectedServiceId,
    selectedLocationId,
    staffInitialData,
  )
  const { mutateAsync: createBooking, isPending } = useCreatePublicBooking(tenantSlug)

  const timezone =
    initialLocations.find((l) => l.id === selectedLocationId)?.timezone ?? 'UTC'

  // Track active section via IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null)
  useEffect(() => {
    observerRef.current?.disconnect()
    const ids = [
      SECTION_IDS.service,
      ...(isMultiLocation ? [SECTION_IDS.location] : []),
      SECTION_IDS.staff,
      SECTION_IDS.datetime,
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveSection(visible[0].target.id)
      },
      { threshold: 0.5 },
    )
    observerRef.current = observer
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [isMultiLocation])

  const navSections = [
    { id: SECTION_IDS.service, label: 'Service' },
    ...(isMultiLocation ? [{ id: SECTION_IDS.location, label: 'Location' }] : []),
    { id: SECTION_IDS.staff, label: 'Staff' },
    { id: SECTION_IDS.datetime, label: 'Time' },
  ]

  function handleServiceSelect(id: string) {
    setSelectedServiceId(id)
    setSelectedStaffId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  function handleStaffSelect(id: string | 'any') {
    setSelectedStaffId(id)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  async function handleSubmit(values: DetailsFormValues) {
    if (!selectedSlot || !selectedService || !selectedLocationId) return
    setSubmitError(null)
    try {
      const result = await createBooking({
        serviceId: selectedService.id,
        locationId: selectedLocationId,
        staffId: selectedStaffId === 'any' ? null : (selectedStaffId ?? null),
        clientName: values.clientName,
        clientPhone: values.clientPhone,
        clientEmail: values.clientEmail || undefined,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
      })
      setBookingResult(result)
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 409) {
        setSelectedSlot(null)
        setSubmitError('This time was just taken. Please select another slot.')
      } else {
        setSubmitError('Something went wrong. Please try again.')
      }
    }
  }

  function handleReset() {
    setBookingResult(null)
    setSelectedServiceId(null)
    setSelectedStaffId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSubmitError(null)
    if (isMultiLocation) setSelectedLocationId(null)
  }

  if (bookingResult) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BookingConfirmation
          result={bookingResult}
          timezone={timezone}
          onReset={handleReset}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">{tenantName}</h1>

      <div className="space-y-10">
        <ServiceSection
          services={services}
          isLoading={servicesLoading}
          selectedId={selectedServiceId}
          onSelect={handleServiceSelect}
        />

        {isMultiLocation && (
          <LocationSection
            locations={initialLocations}
            selectedId={selectedLocationId}
            onSelect={(id) => {
              setSelectedLocationId(id)
              setSelectedStaffId(null)
              setSelectedDate(null)
              setSelectedSlot(null)
            }}
          />
        )}

        <StaffSection
          staff={staff}
          isLoading={staffLoading}
          selectedId={selectedStaffId}
          onSelect={handleStaffSelect}
          prerequisiteMet={selectedServiceId != null && selectedLocationId != null}
          placeholderText={
            isMultiLocation && selectedServiceId != null
              ? 'Select a location first.'
              : 'Select a service first.'
          }
        />

        <DateTimeSection
          tenantSlug={tenantSlug}
          serviceId={selectedServiceId}
          locationId={selectedLocationId}
          staffId={selectedStaffId === 'any' ? null : selectedStaffId}
          timezone={timezone}
          staffSelected={selectedStaffId != null}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onDateSelect={handleDateSelect}
          onSlotSelect={setSelectedSlot}
        />

        <DetailsSection
          selectedSlot={selectedSlot}
          isSubmitting={isPending}
          submitError={submitError}
          onSubmit={handleSubmit}
        />
      </div>

      <FloatingNav sections={navSections} activeSection={activeSection} />
    </main>
  )
}
