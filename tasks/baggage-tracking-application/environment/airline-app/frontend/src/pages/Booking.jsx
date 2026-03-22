import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { flightsAPI, bookingsAPI, mockAPI } from '../services/api';
import { format } from 'date-fns';

const Booking = () => {
  const { flightId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const passengerCount = parseInt(searchParams.get('passengers') || '1');
  const cabinClass = searchParams.get('cabin') || 'economy';

  const [flight, setFlight] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [step, setStep] = useState(1); // 1: details, 2: payment
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFlight();
    initializePassengers();
  }, [flightId]);

  const fetchFlight = async () => {
    try {
      const response = await flightsAPI.getById(flightId);
      setFlight(response.data.data);
    } catch (err) {
      setError('Failed to fetch flight details');
    }
  };

  const initializePassengers = () => {
    const initialPassengers = Array(passengerCount).fill(null).map((_, index) => ({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      nationality: ''
    }));
    setPassengers(initialPassengers);
  };

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
  };

  const [bookingData, setBookingData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('manual'); // 'manual' or 'automated'
  const [paymentData, setPaymentData] = useState({
    card_number: '',
    card_holder: '',
    expiry: '',
    cvv: ''
  });
  const [autoPaymentMessage, setAutoPaymentMessage] = useState('');

  const handlePaymentChange = (field, value) => {
    setPaymentData({
      ...paymentData,
      [field]: value
    });
  };

  const handleProcessPayment = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await mockAPI.processPayment({
        booking_id: bookingData.id,
        ...paymentData
      });

      if (response.data.success) {
        navigate('/my-bookings');
      } else {
        setError(response.data.message || 'Payment failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAutomatedPayment = async () => {
    setLoading(true);
    setError('');
    setAutoPaymentMessage('Automatic payment in progress, please wait...');

    try {
      // Use default test card for automated payment
      const response = await mockAPI.processPayment({
        booking_id: bookingData.id,
        card_number: '4111111111111111',
        card_holder: 'Auto Payment',
        expiry: '12/30',
        cvv: '123'
      });

      if (response.data.success) {
        setAutoPaymentMessage('Payment successful! Redirecting...');
        setTimeout(() => {
          navigate('/my-bookings');
        }, 1000);
      } else {
        setError(response.data.message || 'Payment failed');
        setAutoPaymentMessage('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
      setAutoPaymentMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    setLoading(true);
    setError('');

    // Validate passenger data
    for (let i = 0; i < passengers.length; i++) {
      const passenger = passengers[i];
      if (!passenger.first_name || !passenger.first_name.trim()) {
        setError(`Passenger ${i + 1}: First name is required`);
        setLoading(false);
        return;
      }
      if (!passenger.last_name || !passenger.last_name.trim()) {
        setError(`Passenger ${i + 1}: Last name is required`);
        setLoading(false);
        return;
      }
      if (!passenger.date_of_birth) {
        setError(`Passenger ${i + 1}: Date of birth is required`);
        setLoading(false);
        return;
      }
    }

    try {
      const bookingData = {
        flight_id: parseInt(flightId),
        cabin_class: cabinClass.toLowerCase(),
        passengers: passengers
      };

      const response = await bookingsAPI.create(bookingData);
      const booking = response.data.data;

      // Proceed to payment
      setStep(2);
      setBookingData(booking);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create booking';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  };

  if (!flight) {
    return <div className="loading">Loading flight details...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>Book Flight {flight.flight_number}</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        <h3>Flight Details</h3>
        <p><strong>Route:</strong> {flight.origin.code} → {flight.destination.code}</p>
        <p><strong>Departure:</strong> {formatDateTime(flight.departure_time)}</p>
        <p><strong>Cabin Class:</strong> {cabinClass.charAt(0).toUpperCase() + cabinClass.slice(1)}</p>
        <p><strong>Passengers:</strong> {passengerCount}</p>
        <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '10px' }}>
          Total Price: ${((flight.pricing[cabinClass] || flight.pricing.economy) * passengerCount).toFixed(2)}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '10px',
        background: '#f5f5f5',
        borderRadius: '5px'
      }}>
        <span style={{ fontWeight: step === 1 ? 'bold' : 'normal' }}>
          {step >= 1 ? '✓' : '○'} 1. Passenger Details
        </span>
        <span style={{ fontWeight: step === 2 ? 'bold' : 'normal' }}>
          {step >= 2 ? '✓' : '○'} 2. Payment
        </span>
      </div>

      {/* Step 1: Passenger Details */}
      {step === 1 && (
        <div>
          {passengers.map((passenger, index) => (
            <div key={index} className="card">
              <h3>Passenger {index + 1}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={passenger.first_name}
                    onChange={(e) => handlePassengerChange(index, 'first_name', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={passenger.last_name}
                    onChange={(e) => handlePassengerChange(index, 'last_name', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    value={passenger.date_of_birth}
                    onChange={(e) => handlePassengerChange(index, 'date_of_birth', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            className="btn-primary"
            onClick={handleCreateBooking}
            disabled={loading}
          >
            {loading ? 'Creating Booking...' : 'Continue to Payment'}
          </button>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div>
          {bookingData && (
            <div className="card">
              <h3>Payment Details</h3>
              <p><strong>Booking Reference:</strong> {bookingData.booking_reference}</p>
              <p><strong>Total Amount:</strong> ${bookingData.total_price.toFixed(2)}</p>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="card">
            <h3>Choose Payment Method</h3>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <button
                onClick={() => setPaymentMethod('manual')}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: paymentMethod === 'manual' ? '#4a90e2' : '#f5f5f5',
                  color: paymentMethod === 'manual' ? 'white' : '#333',
                  border: paymentMethod === 'manual' ? '2px solid #357abd' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                💳 Manual Payment
              </button>
              <button
                onClick={() => setPaymentMethod('automated')}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: paymentMethod === 'automated' ? '#28a745' : '#f5f5f5',
                  color: paymentMethod === 'automated' ? 'white' : '#333',
                  border: paymentMethod === 'automated' ? '2px solid #218838' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                ⚡ Automated Payment
              </button>
            </div>

            {/* Manual Payment Form */}
            {paymentMethod === 'manual' && (
              <div>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                  Test card: 4111111111111111 (Visa) - Any future expiry, any 3 digits CVV
                </p>

                <div className="form-group">
                  <label>Card Number</label>
                  <input
                    type="text"
                    value={paymentData.card_number}
                    onChange={(e) => handlePaymentChange('card_number', e.target.value)}
                    placeholder="4111111111111111"
                    maxLength="19"
                  />
                </div>

                <div className="form-group">
                  <label>Card Holder Name</label>
                  <input
                    type="text"
                    value={paymentData.card_holder}
                    onChange={(e) => handlePaymentChange('card_holder', e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Expiry (MM/YY)</label>
                    <input
                      type="text"
                      value={paymentData.expiry}
                      onChange={(e) => handlePaymentChange('expiry', e.target.value)}
                      placeholder="12/28"
                      maxLength="5"
                    />
                  </div>

                  <div className="form-group">
                    <label>CVV</label>
                    <input
                      type="text"
                      value={paymentData.cvv}
                      onChange={(e) => handlePaymentChange('cvv', e.target.value)}
                      maxLength="4"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Automated Payment */}
            {paymentMethod === 'automated' && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <p style={{ color: '#666', fontSize: '16px', marginBottom: '20px' }}>
                  Use our automated payment system for quick processing.
                  <br />Payment will be processed automatically using saved payment method.
                </p>
                {autoPaymentMessage && (
                  <div style={{
                    background: '#d4edda',
                    color: '#155724',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '16px',
                    fontWeight: '500'
                  }}>
                    {autoPaymentMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="btn-secondary"
            onClick={() => setStep(1)}
            style={{ marginRight: '10px' }}
            disabled={loading}
          >
            Back
          </button>
          <button
            className="btn-success"
            onClick={paymentMethod === 'manual' ? handleProcessPayment : handleAutomatedPayment}
            disabled={loading}
          >
            {loading ? (paymentMethod === 'automated' ? 'Processing...' : 'Processing...') : (paymentMethod === 'manual' ? 'Pay Now' : 'Start Automated Payment')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Booking;
