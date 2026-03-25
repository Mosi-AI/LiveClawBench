import random
from app.models import db

class MockChatBot:
    """Mock customer support chat bot"""

    # Predefined responses for common queries
    RESPONSES = {
        'greeting': [
            "Hello! I'm your virtual assistant. How can I help you today?",
            "Welcome to AirLine support! What can I assist you with?",
            "Hi there! I'm here to help with your travel needs."
        ],
        'booking': {
            'keywords': ['booking', 'reservation', 'book flight', 'make booking'],
            'responses': [
                "To make a booking, you can search for flights on our website and select your preferred flight. Need help with anything specific?",
                "You can book flights through our website. Would you like me to guide you through the process?",
                "Booking a flight is easy! Search for your route, select a flight, add passenger details, and complete payment. Any questions?"
            ]
        },
        'check_in': {
            'keywords': ['check-in', 'check in', 'boarding pass', 'checkin'],
            'responses': [
                "Online check-in opens 24 hours before your flight departure. You can check in through our website using your booking reference.",
                "To check in, go to the Check-In section and enter your booking reference. You'll be able to select seats and download your boarding pass.",
                "Check-in is available 24 hours before departure. Make sure you have your booking reference ready!"
            ]
        },
        'cancellation': {
            'keywords': ['cancel', 'cancellation', 'refund', 'cancel booking'],
            'responses': [
                "To cancel your booking, go to My Bookings, select your booking, and click Cancel. Refunds are processed within 5-7 business days.",
                "You can cancel bookings through our website. Refund eligibility depends on how far in advance you cancel.",
                "For cancellations, visit My Bookings section. Would you like to know our cancellation policy?"
            ]
        },
        'baggage': {
            'keywords': ['baggage', 'luggage', 'bag', 'suitcase'],
            'responses': [
                "Economy class includes 1 carry-on bag (7kg) and 1 checked bag (23kg). Business and First class have higher allowances.",
                "Your baggage allowance depends on your ticket class. Economy: 1 carry-on + 1 checked bag. Business: 2 carry-on + 2 checked bags.",
                "Need baggage info? Economy includes 23kg checked luggage. Additional baggage can be purchased during booking or check-in."
            ]
        },
        'flight_status': {
            'keywords': ['flight status', 'delay', 'delayed', 'on time', 'departure time'],
            'responses': [
                "You can check your flight status on our website or app. Enter your flight number or booking reference for real-time updates.",
                "For flight status updates, visit the Flight Status section. We'll also send email notifications for any delays or changes.",
                "Flight status is updated in real-time. You can check it on our website using your booking reference."
            ]
        },
        'seats': {
            'keywords': ['seat', 'seating', 'choose seat', 'select seat', 'seat selection'],
            'responses': [
                "You can select seats during booking or check-in. Some seats may have additional charges for extra legroom or preferred location.",
                "Seat selection is available during booking and check-in. Window and aisle seats are popular choices!",
                "To choose your seat, go to your booking and click 'Select Seats'. You can see the seat map and pick your preferred seat."
            ]
        },
        'payment': {
            'keywords': ['payment', 'pay', 'credit card', 'visa', 'mastercard'],
            'responses': [
                "We accept Visa, MasterCard, American Express, and Discover. Payment is processed securely through our payment gateway.",
                "You can pay using major credit cards. Your payment information is encrypted and secure.",
                "Payment can be made with credit or debit cards. We use secure payment processing to protect your information."
            ]
        },
        'contact': {
            'keywords': ['contact', 'phone number', 'customer service', 'speak to someone', 'human', 'agent'],
            'responses': [
                "Our customer service team is available 24/7. You can reach us at 1-800-AIRLINE or support@airline.com",
                "Need to speak with someone? Call us at 1-800-AIRLINE or email support@airline.com. We're here to help!",
                "For personalized assistance, contact our customer service at 1-800-AIRLINE. Our team is available around the clock."
            ]
        },
        'thanks': {
            'keywords': ['thank', 'thanks', 'helpful', 'great'],
            'responses': [
                "You're welcome! Is there anything else I can help you with?",
                "Happy to help! Feel free to ask if you have more questions.",
                "Thank you for choosing AirLine! Have a great day!"
            ]
        },
        'goodbye': {
            'keywords': ['bye', 'goodbye', 'see you', 'later'],
            'responses': [
                "Goodbye! Have a pleasant journey!",
                "Take care! We hope to see you on board soon.",
                "Bye! Safe travels!"
            ]
        }
    }

    DEFAULT_RESPONSES = [
        "I'm not sure I understand. Could you rephrase your question?",
        "I don't have information about that. Would you like to speak with a customer service representative?",
        "I'm still learning! For this query, please contact our customer service at 1-800-AIRLINE.",
        "Could you provide more details? I'd like to help you better.",
        "That's an interesting question! Let me connect you with our support team for detailed assistance."
    ]

    def __init__(self):
        """Initialize mock chat bot"""
        pass

    def get_welcome_message(self):
        """Get welcome message for new chat session"""
        return random.choice(self.RESPONSES['greeting'])

    def detect_intent(self, message):
        """
        Detect intent from user message

        Args:
            message (str): User message

        Returns:
            str: Detected intent or None
        """
        message_lower = message.lower()

        for intent, data in self.RESPONSES.items():
            if intent in ['greeting']:
                continue

            if isinstance(data, dict) and 'keywords' in data:
                for keyword in data['keywords']:
                    if keyword in message_lower:
                        return intent

        return None

    def get_response(self, message):
        """
        Get chat bot response for user message

        Args:
            message (str): User message

        Returns:
            str: Bot response
        """
        # Detect intent
        intent = self.detect_intent(message)

        if intent and intent in self.RESPONSES:
            responses = self.RESPONSES[intent]
            if isinstance(responses, dict):
                return random.choice(responses['responses'])
            else:
                return random.choice(responses)

        # Check for greeting keywords
        message_lower = message.lower()
        greeting_words = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening']
        if any(word in message_lower for word in greeting_words):
            return random.choice(self.RESPONSES['greeting'])

        # Return default response
        return random.choice(self.DEFAULT_RESPONSES)

    def get_quick_replies(self):
        """
        Get quick reply suggestions

        Returns:
            list: List of quick reply options
        """
        return [
            "How do I check in?",
            "What's my baggage allowance?",
            "How can I cancel my booking?",
            "I want to select my seat",
            "What's the flight status?",
            "Contact customer service"
        ]
