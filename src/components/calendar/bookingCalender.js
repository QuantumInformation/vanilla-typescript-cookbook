import BaseComponent from '../baseComponent'
import moment from 'moment'
import defaultSettings from '../../configuration/defaultSettings'
import DialogueForm from '../dialogueForm/dialogueForm'
import mockApi from '../../api/mocks/mockApi'
import state from '../../util/stateManager/stateManager'

/**
 * BookingCalander
 * The component allow the parent to delegate the task of sorting and filter to itself, but the
 * parent can still pass filtering to the component which will save time. Bookings are applied
 * by use query selectors on data-moment attributes
 *
 * CONVENTIONS
 * data attributes in dom take the object (booking) and use camel casing to append the attribute,
 * ie data-booking-id and date-booking-date for id and the date propson booking objects
 *
 */
export default class BookingCalander extends BaseComponent {
  constructor () {
    const template =
      `<div class = 'bookingCalender'>
        <h1>bookingCalender</h1>
        <div class="weekCalendarView"></div>
      </div>`

    super(template)
  }

  /**
   *  any click on the calendar or the body will close the calendar, we just inspect the target to
   *  determine what action to take
   */
  addListeners () {
    // when this is clicked just close the calendar as it has 0 effect on the delivery slots
    this._hostElement.querySelector('tbody').addEventListener('mouseup', event => {
      // toto check if() tbody td:not(:first-child)
      const title = 'New booking'
      const description = 'Complete this form to add a new booking.'
      const subtitle = `${moment(event.target.dataset.bookingDate).format('YYYY/MM/DD')}`
      // todo make field a class?
      const fields = [
        {
          name: 'additionalInfo',
          type: 'text',
          placeholder: 'Additional info',
          value: 'foo',
          editable: true
        },
        {
          name: 'date',
          type: 'text',
          value: event.target.dataset.bookingDate
        }
      ]

      const dialogueForm = new DialogueForm(title, subtitle, description, fields)
      dialogueForm.addEventListener('onSubmit', this.onSaveOrEdit.bind(this))
      dialogueForm.show()
    })
  }

  handleDialogueFormSubmit () {

  }

  /**
   * Gives the html to render the booking
   * @param {Booking} booking
   * @returns {string}
   */
  renderBooking (booking) {
    return `<article booking-id="${booking.id}" class="booking">
              <div class="Name">${booking.user}</div>
              <div class="info">${booking.additionalInfo}</div>
            </article>`
  }

  /**
   * renders a calendar for a given week
   * all the data is then stored in the dom which simplifies handling user interaction
   *
   * //todo whenever data changes rerender
   *
   * @param {moment} start of that week to render, dates are worked out from this
   */
  getWeekTable (weekStart) {
    const totalSlots = (defaultSettings.endHours - defaultSettings.startHours) * 2 + 2
    let trackingIndex = 0 // used to increment the day for each td rendered
    const currentTime = weekStart.clone().hours(defaultSettings.startHours)

    // the time row spans the same week (one tr, with same times and incrementing days)
    const timeRow = Array(totalSlots).fill(0).map(i => {
      let newRow = '<tr>'
      for (trackingIndex = 0; trackingIndex < 8; trackingIndex++) {
        if (trackingIndex === 0) { // render the time column
          newRow += `<td class="time">${currentTime.format('HH:mm')}</td>`
        } else {
          const nextDay = currentTime.clone().add(trackingIndex - 1, 'days')
          newRow += `<td class="timeSlot" data-booking-date="${nextDay.toISOString()}"></td>`
        }
      }
      newRow += '</tr>'
      currentTime.add(30, 'minutes')
      return newRow
    }).join('')

    return `<h1>${weekStart.format('MMMM YYYY')}</h1>
              <table border="0" cellspacing="0" cellpadding="0">
               <thead>
                 <tr>
                   <td></td>
                   <td>${weekStart.clone().add(1, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(2, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(3, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(4, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(5, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(6, 'day').format('DD dddd')}</td>
                   <td>${weekStart.clone().add(7, 'day').format('DD dddd')}</td>
                 </tr>
                 </thead>
                 ${timeRow}
             </table>`
  }

  /**
   * @param {moment} weekStart
   * @param any number of bookings
   */
  switchToWeekView (weekStart) {
    this._hostElement.querySelector('.weekCalendarView').innerHTML = this.getWeekTable(weekStart)
    this._applyBookings(weekStart)
    this.addListeners()
  }

  /**
   * listens to onsub
   * @param event
   */
  onSaveOrEdit (event) {
    mockApi.saveBooking(
      state.loggedInUser,
      event.detail.date,
      defaultSettings.bookingDurationMinutes,
      event.detail.additionalInfo)
      .then(newBooking => {
        // todo make this more safe?
        state.bookings.push(newBooking)
        this.appendBookingToCalendar(newBooking)
      })
  }

  /**
   *
   * @param {Booking} booking booking to be added
   */
  appendBookingToCalendar (booking) {
    const q = `[data-booking-date="${booking.date.toISOString()}"]`
    const element = this._hostElement.querySelector(q)
    element.innerHTML = this.renderBooking(booking)
  }

  /**
   * Add each booking relevant to this week to the grid
   *
   * Each booking may or may not taking up more than 1 time slot
   * @param bookings the bookings
   * @param start start of this week
   * @private
   */
  _applyBookings (start) {
    // filter the bookings for just this booking calendar week (next mon - end of next sun)
    state.bookings.filter(booking => {
      return booking.date.isBetween(start, start.clone().add(7, 'days'))
    }).forEach(booking => {
      // get grid slots that relevent to this booking
      // assume everything divides nicely
      const slotsNeeded = booking.durationMinutes /
        defaultSettings.bookingTimeResolution
      const query = Array(slotsNeeded).fill(0).map((e, i) => i).map(i => {
        const iso = booking.date.add(defaultSettings.bookingTimeResolution, 'm')
          .toISOString()
        return `[data-booking-date="${iso}"]`
      }).join(',')
      const currentElements = this._hostElement.querySelectorAll(query)

      // update the elements
      Array.from(currentElements).forEach(element => {
        element.innerHTML = this.renderBooking(booking)
      })
    })
  }
}
