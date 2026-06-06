import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flightsAPI } from '../services/api';
import { format } from 'date-fns';

const SearchFlights = () => {
  const [searchParams, setSearchParams] = useState({
    origin: '',
    destination: '',
    departure_date: '',
    passengers: 1,
    cabin_class: 'economy'
  });
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleChange = (e) => {
    setSearchParams({
      ...searchParams,
      [e.target.name]: e.target.value
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await flightsAPI.search(searchParams);
      setFlights(response.data.data.flights);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search flights');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlight = (flightId) => {
    navigate(`/booking/${flightId}?passengers=${searchParams.passengers}&cabin=${searchParams.cabin_class}`);
  };

  const formatDateTime = (dateString) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ marginBottom: '10px', fontSize: '36px' }}>🔍 Search Flights</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>Find the perfect flight for your journey</p>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)', padding: '30px' }}>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-group">
              <label>Origin Airport</label>
              <input
                type="text"
                name="origin"
                value={searchParams.origin}
                onChange={handleChange}
                placeholder="e.g., JFK"
                required
                maxLength="3"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label>Destination Airport</label>
              <input
                type="text"
                name="destination"
                value={searchParams.destination}
                onChange={handleChange}
                placeholder="e.g., LAX"
                required
                maxLength="3"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label>Departure Date</label>
              <input
                type="date"
                name="departure_date"
                value={searchParams.departure_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Passengers</label>
              <select
                name="passengers"
                value={searchParams.passengers}
                onChange={handleChange}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} Passenger{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Cabin Class</label>
              <select
                name="cabin_class"
                value={searchParams.cabin_class}
                onChange={handleChange}
              >
                <option value="economy">🪑 Economy</option>
                <option value="business">💼 Business</option>
                <option value="first">✨ First Class</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{
            width: '100%',
            padding: '16px',
            fontSize: '17px',
            fontWeight: '600',
            marginTop: '10px'
          }}>
            {loading ? '🔍 Searching...' : '✈️ Search Flights'}
          </button>
        </form>
      </div>

      {error && <div className="error-message">{error}</div>}

      {searched && (
        <div style={{ marginTop: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ margin: 0 }}>Available Flights</h2>
            <span style={{ fontSize: '18px', color: '#666' }}>
              {flights.length} flight{flights.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {flights.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px 30px' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>😔</div>
              <h3 style={{ marginBottom: '10px' }}>No Flights Found</h3>
              <p style={{ color: '#666', fontSize: '16px' }}>
                No flights available for the selected route and date. Try different search criteria.
              </p>
            </div>
          ) : (
            flights.map(flight => (
              <div key={flight.id} className="card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '25px',
                border: flight.status === 'cancelled' ? '2px solid #dc3545' : '1px solid #e0e0e0'
              }}>
                <div style={{ flex: '1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '24px', color: '#4a90e2' }}>{flight.flight_number}</h3>
                    <span style={{
                      padding: '6px 12px',
                      background: flight.status === 'scheduled' ? '#d4edda' :
                                 flight.status === 'delayed' ? '#fff3cd' : '#f8d7da',
                      color: flight.status === 'scheduled' ? '#155724' :
                             flight.status === 'delayed' ? '#856404' : '#721c24',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      {flight.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#222' }}>{flight.origin?.code ?? flight.origin_code}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{formatDateTime(flight.departure_time)}</div>
                    </div>
                    <div style={{ flex: '1', textAlign: 'center', color: '#999' }}>
                      <div style={{ fontSize: '20px' }}>✈️</div>
                      <div style={{ fontSize: '13px', marginTop: '5px' }}>{formatDuration(flight.duration_minutes)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#222' }}>{flight.destination?.code ?? flight.destination_code}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{formatDateTime(flight.arrival_time)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', fontSize: '14px', color: '#666' }}>
                    <div>🛩️ <strong>Aircraft:</strong> {flight.aircraft_type}</div>
                    <div>💺 <strong>Available:</strong> {flight.available_seats?.[searchParams.cabin_class] ?? '—'} seats</div>
                  </div>

                  {flight.status === 'delayed' && flight.delay_minutes > 0 && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#fff3cd', borderRadius: '6px', fontSize: '14px' }}>
                      ⚠️ <strong>Delay:</strong> {flight.delay_minutes} minutes - {flight.delay_reason || 'Operational reasons'}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', marginLeft: '30px', minWidth: '180px' }}>
                  <div style={{ marginBottom: '5px', fontSize: '14px', color: '#666' }}>per passenger</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4a90e2', marginBottom: '15px' }}>
                    ${((flight.pricing?.[searchParams.cabin_class]) ?? flight[`base_price_${searchParams.cabin_class}`])?.toFixed(2) || 'N/A'}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => handleSelectFlight(flight.id)}
                    disabled={flight.status === 'cancelled'}
                    style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                  >
                    {flight.status === 'cancelled' ? '❌ Cancelled' : '✓ Select'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFlights;
