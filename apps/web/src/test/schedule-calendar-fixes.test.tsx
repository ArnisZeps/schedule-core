import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeSelect } from '@/components/ui/TimeSelect'

describe('TimeSelect', () => {
  it('hour select contains exactly 24 options, 00 through 23', () => {
    render(<TimeSelect id="t" value="00:00" onChange={() => {}} />)
    const hourSelect = screen.getByTestId('time-hour-select')
    const options = within(hourSelect).getAllByRole('option')
    expect(options).toHaveLength(24)
    expect(options[0]).toHaveValue('00')
    expect(options[23]).toHaveValue('23')
  })

  it('minute select contains options 00, 05, 10, ..., 55 (12 total)', () => {
    render(<TimeSelect id="t" value="00:00" onChange={() => {}} />)
    const minSelect = screen.getByTestId('time-min-select')
    const options = within(minSelect).getAllByRole('option')
    expect(options).toHaveLength(12)
    expect(options[0]).toHaveValue('00')
    expect(options[1]).toHaveValue('05')
    expect(options[11]).toHaveValue('55')
  })

  it('reflects a pre-filled HH:MM value in the correct selects', () => {
    render(<TimeSelect id="t" value="14:35" onChange={() => {}} />)
    expect(screen.getByTestId('time-hour-select')).toHaveValue('14')
    expect(screen.getByTestId('time-min-select')).toHaveValue('35')
  })

  it('calls onChange with updated HH:MM when hour changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeSelect id="t" value="09:30" onChange={onChange} />)
    await user.selectOptions(screen.getByTestId('time-hour-select'), '17')
    expect(onChange).toHaveBeenCalledWith('17:30')
  })

  it('calls onChange with updated HH:MM when minute changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeSelect id="t" value="09:30" onChange={onChange} />)
    await user.selectOptions(screen.getByTestId('time-min-select'), '45')
    expect(onChange).toHaveBeenCalledWith('09:45')
  })

  it('empty value defaults both selects to 00 without error', () => {
    render(<TimeSelect id="t" value="" onChange={() => {}} />)
    expect(screen.getByTestId('time-hour-select')).toHaveValue('00')
    expect(screen.getByTestId('time-min-select')).toHaveValue('00')
  })

  it('label htmlFor points to the hour select', () => {
    render(
      <div>
        <label htmlFor="t">Start time</label>
        <TimeSelect id="t" value="10:00" onChange={() => {}} />
      </div>,
    )
    expect(screen.getByLabelText('Start time')).toBe(screen.getByTestId('time-hour-select'))
  })
})
