import React, { useState, useEffect } from 'react';
import { bookingsAPI } from '../services/api';
import { format } from 'date-fns';

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await bookingsAPI.getAll();
      setBookings(response.data.data.bookings);
    } catch (err) {
      setError('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (reference) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      await bookingsAPI.cancel(reference);
      fetchBookings(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const formatDateTime = (dateString) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'pending': return 'orange';
      case 'cancelled': return 'red';
      case 'checked_in': return 'blue';
      default: return 'black';
    }
  };

  const getFlightStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#17a2b8';
      case 'on-time': return '#28a745';
      case 'delayed': return '#ffc107';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getFlightStatusText = (flight) => {
    if (!flight) return 'Unknown';
    if (flight.status === 'delayed' && flight.delay_minutes > 0) {
      return `Delayed by ${flight.delay_minutes} minutes`;
    }
    if (flight.status === 'cancelled') {
      return 'Cancelled';
    }
    if (flight.status === 'scheduled') {
      return 'Scheduled';
    }
    return 'On Time';
  };

  if (loading) {
    return <div className="loading">Loading bookings...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ marginBottom: '10px', fontSize: '36px' }}>📋 My Bookings</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>View and manage your flight bookings</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {bookings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎫</div>
          <h3 style={{ marginBottom: '15px' }}>No Bookings Yet</h3>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '25px' }}>
            You haven't made any bookings yet. Search for flights to get started!
          </p>
          <a href="/search" className="btn-primary" style={{
            display: 'inline-block',
            padding: '14px 32px',
            textDecoration: 'none',
            fontSize: '16px'
          }}>
            ✈️ Search Flights
          </a>
        </div>
      ) : (
        bookings.map(booking => (
          <div key={booking.id} className="card" style={{ padding: '28px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              marginBottom: '20px',
              paddingBottom: '20px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div>
                <h3 style={{ marginBottom: '8px', fontSize: '24px' }}>
                  Booking Reference: <span style={{ color: '#4a90e2' }}>{booking.booking_reference}</span>
                </h3>
                <p style={{ color: '#666', fontSize: '16px', margin: 0 }}>
                  Flight {booking.flight?.flight_number}
                </p>
              </div>
              <span style={{
                padding: '8px 18px',
                background: getStatusColor(booking.booking_status),
                color: 'white',
                borderRadius: '25px',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                {booking.booking_status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Airline</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>
                  {booking.flight?.airline || 'GKD Airlines'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Route</p>
                <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                  {booking.flight?.origin?.code} → {booking.flight?.destination?.code}
                </p>
                <p style={{ fontSize: '12px', color: '#666', margin: '3px 0 0 0' }}>
                  {booking.flight?.origin?.city} → {booking.flight?.destination?.city}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Departure</p>
                <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  {booking.flight?.departure_time && formatDateTime(booking.flight.departure_time)}
                </p>
                <p style={{ fontSize: '12px', color: '#666', margin: '3px 0 0 0' }}>
                  {booking.flight?.origin?.airport}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Arrival</p>
                <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  {booking.flight?.arrival_time && formatDateTime(booking.flight.arrival_time)}
                </p>
                <p style={{ fontSize: '12px', color: '#666', margin: '3px 0 0 0' }}>
                  {booking.flight?.destination?.airport}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Duration</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>
                  {booking.flight?.duration_minutes && `${Math.floor(booking.flight.duration_minutes / 60)}h ${booking.flight.duration_minutes % 60}m`}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Flight Status</p>
                <p style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  margin: 0,
                  color: getFlightStatusColor(booking.flight?.status)
                }}>
                  {getFlightStatusText(booking.flight)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Gate / Terminal</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>
                  {booking.flight?.gate || 'TBD'} / {booking.flight?.terminal || 'TBD'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Aircraft</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>
                  {booking.flight?.aircraft_type || 'Boeing 737'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Cabin Class</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>
                  {booking.cabin_class.charAt(0).toUpperCase() + booking.cabin_class.slice(1)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#999', marginBottom: '5px' }}>Total Price</p>
                <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#4a90e2', margin: 0 }}>
                  ${booking.total_price.toFixed(2)}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ marginBottom: '10px', fontSize: '15px', fontWeight: '600' }}>
                Passengers ({booking.passengers?.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {booking.passengers?.map((passenger, index) => (
                  <span key={index} style={{
                    display: 'inline-block',
                    padding: '8px 14px',
                    background: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    border: '1px solid #e0e0e0'
                  }}>
                    👤 {passenger.first_name} {passenger.last_name}
                    {passenger.seat && <span style={{ color: '#4a90e2', marginLeft: '8px' }}>Seat {passenger.seat.seat_number}</span>}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {booking.booking_status === 'confirmed' && !booking.checked_in && (
                <>
                  <button
                    className="btn-primary"
                    onClick={() => window.location.href = `/seat-selection/${booking.booking_reference}`}
                    style={{ flex: '1', minWidth: '150px' }}
                    disabled={booking.passengers?.every(p => p.seat)}
                  >
                    💺 Select Seats
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => window.location.href = `/checkin?booking=${booking.booking_reference}`}
                    style={{ flex: '1', minWidth: '150px' }}
                  >
                    ✅ Check In
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleCancelBooking(booking.booking_reference)}
                    style={{ flex: '1', minWidth: '150px' }}
                  >
                    ❌ Cancel Booking
                  </button>
                </>
              )}

              {(booking.booking_status === 'checked_in' || (booking.booking_status === 'confirmed' && booking.checked_in)) && (
                <button
                  className="btn-primary"
                  onClick={() => window.location.href = `/checkin?booking=${booking.booking_reference}`}
                  style={{ width: '100%' }}
                >
                  📱 View Boarding Pass
                </button>
              )}

              {booking.flight?.status === 'delayed' && (
                <button
                  className="btn-secondary"
                  onClick={() => window.location.href = `/claims?booking=${booking.booking_reference}`}
                  style={{ width: '100%' }}
                >
                  💰 File Delay Claim
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MyBookings;
