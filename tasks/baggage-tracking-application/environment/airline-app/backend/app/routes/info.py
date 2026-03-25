from flask import Blueprint, jsonify

info_bp = Blueprint('info', __name__)

@info_bp.route('/restaurant', methods=['GET'])
def get_restaurant_info():
    """Get restaurant information"""
    try:
        # Static restaurant information
        restaurants = [
            {
                'id': 1,
                'name': 'Sky Lounge Restaurant',
                'location': 'Terminal 1, Gate A',
                'operating_hours': '06:00 - 23:00',
                'cuisine_type': 'International',
                'description': 'Premium dining experience with international cuisine and stunning runway views.',
                'phone': '+1-555-0101',
                'rating': 4.5,
                'image_url': '/images/sky-lounge.jpg'
            },
            {
                'id': 2,
                'name': 'Quick Bites Cafe',
                'location': 'Terminal 1, Concourse B',
                'operating_hours': '05:00 - 22:00',
                'cuisine_type': 'Fast Food',
                'description': 'Quick service cafe offering sandwiches, salads, and beverages.',
                'phone': '+1-555-0102',
                'rating': 4.0,
                'image_url': '/images/quick-bites.jpg'
            },
            {
                'id': 3,
                'name': 'Asian Wok',
                'location': 'Terminal 2, Food Court',
                'operating_hours': '07:00 - 21:00',
                'cuisine_type': 'Asian',
                'description': 'Authentic Asian cuisine including Chinese, Japanese, and Thai dishes.',
                'phone': '+1-555-0103',
                'rating': 4.3,
                'image_url': '/images/asian-wok.jpg'
            },
            {
                'id': 4,
                'name': 'Coffee Corner',
                'location': 'Terminal 1, Gate C',
                'operating_hours': '04:00 - 24:00',
                'cuisine_type': 'Cafe',
                'description': 'Specialty coffee, pastries, and light snacks for travelers.',
                'phone': '+1-555-0104',
                'rating': 4.6,
                'image_url': '/images/coffee-corner.jpg'
            },
            {
                'id': 5,
                'name': 'Steak House Grill',
                'location': 'Terminal 2, Premium Lounge',
                'operating_hours': '11:00 - 23:00',
                'cuisine_type': 'Steakhouse',
                'description': 'Premium steaks and grilled specialties with an extensive wine list.',
                'phone': '+1-555-0105',
                'rating': 4.7,
                'image_url': '/images/steak-house.jpg'
            }
        ]

        return jsonify({
            'success': True,
            'data': {
                'restaurants': restaurants
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@info_bp.route('/airport', methods=['GET'])
def get_airport_info():
    """Get airport information"""
    try:
        # Static airport information
        airport_info = {
            'name': 'GKD International Airport',
            'code': 'GKD',
            'location': 'Main City, Country',
            'terminals': [
                {
                    'id': 1,
                    'name': 'Terminal 1',
                    'description': 'Domestic flights and regional connections',
                    'gates': 'A1-A30, B1-B25',
                    'facilities': ['Check-in counters', 'Security checkpoints', 'Restrooms', 'ATM', 'Currency exchange'],
                    'map_url': '/images/terminal1-map.jpg'
                },
                {
                    'id': 2,
                    'name': 'Terminal 2',
                    'description': 'International flights and premium services',
                    'gates': 'C1-C35, D1-D30',
                    'facilities': ['VIP lounges', 'Duty-free shops', 'Restaurants', 'Spa', 'Shower facilities'],
                    'map_url': '/images/terminal2-map.jpg'
                }
            ],
            'services': [
                {
                    'name': 'WiFi',
                    'description': 'Free WiFi available throughout the airport',
                    'location': 'All terminals',
                    'cost': 'Free'
                },
                {
                    'name': 'Luggage Storage',
                    'description': 'Secure luggage storage service',
                    'location': 'Terminal 1, Ground Floor',
                    'cost': '$5/hour per bag'
                },
                {
                    'name': 'Medical Center',
                    'description': '24/7 medical assistance',
                    'location': 'Terminal 1, First Floor',
                    'cost': 'Based on service'
                },
                {
                    'name': 'Currency Exchange',
                    'description': 'Multi-currency exchange services',
                    'location': 'All terminals',
                    'cost': 'Service fees apply'
                },
                {
                    'name': 'Car Rental',
                    'description': 'Major car rental companies available',
                    'location': 'Terminal 1, Ground Floor',
                    'cost': 'Varies by provider'
                }
            ],
            'parking': {
                'short_term': {
                    'location': 'Near Terminal 1',
                    'capacity': 500,
                    'rate': '$3/hour'
                },
                'long_term': {
                    'location': '500m from terminals',
                    'capacity': 2000,
                    'rate': '$15/day'
                },
                'valet': {
                    'location': 'Terminal drop-off zones',
                    'rate': '$25/day'
                }
            },
            'transportation': {
                'taxi': 'Available 24/7 at designated stands',
                'train': 'Airport Express line to city center (5-minute intervals)',
                'bus': 'Shuttle buses to major locations',
                'rental': 'Car rental services in Terminal 1'
            },
            'contact': {
                'phone': '+1-555-AIRPORT',
                'email': 'info@gkdairport.com',
                'website': 'www.gkdairport.com'
            }
        }

        return jsonify({
            'success': True,
            'data': airport_info
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
