import json
import random
import string
from datetime import datetime


class MockPaymentGateway:
    """Mock payment gateway simulating Visa payment processing"""

    def __init__(self, success_rate=0.90):
        """
        Initialize mock payment gateway

        Args:
            success_rate (float): Success rate for payments (0.0 to 1.0)
        """
        self.success_rate = success_rate

    def validate_card(self, card_number, expiry, cvv):
        """
        Validate credit card details

        Args:
            card_number (str): Credit card number
            expiry (str): Expiry date (MM/YY format)
            cvv (str): CVV code

        Returns:
            tuple: (is_valid, error_message)
        """
        # Remove spaces and dashes
        card_number = card_number.replace(" ", "").replace("-", "")

        # Check card number length
        if len(card_number) < 13 or len(card_number) > 19:
            return False, "Invalid card number length"

        # Check if card number is numeric
        if not card_number.isdigit():
            return False, "Card number must contain only digits"

        # Validate expiry format
        try:
            month, year = expiry.split("/")
            month = int(month)
            year = int(year)

            if month < 1 or month > 12:
                return False, "Invalid expiry month"

            # Check if card is expired
            current_year = datetime.now().year % 100
            current_month = datetime.now().month

            if year < current_year or (year == current_year and month < current_month):
                return False, "Card has expired"

        except (ValueError, AttributeError):
            return False, "Invalid expiry date format (use MM/YY)"

        # Validate CVV
        if not cvv.isdigit() or len(cvv) not in [3, 4]:
            return False, "Invalid CVV"

        return True, None

    def detect_card_type(self, card_number):
        """
        Detect credit card type from number

        Args:
            card_number (str): Credit card number

        Returns:
            str: Card type (visa, mastercard, amex, etc.)
        """
        card_number = card_number.replace(" ", "").replace("-", "")

        if card_number.startswith("4"):
            return "visa"
        elif card_number.startswith(("51", "52", "53", "54", "55")):
            return "mastercard"
        elif card_number.startswith(("34", "37")):
            return "amex"
        elif card_number.startswith("6"):
            return "discover"
        else:
            return "unknown"

    def generate_transaction_id(self):
        """Generate unique transaction ID"""
        return "TXN" + "".join(random.choices(string.digits, k=12))

    def process_payment(self, amount, card_number, card_holder, expiry, cvv):
        """
        Process payment through mock gateway

        Args:
            amount (float): Payment amount
            card_number (str): Credit card number
            card_holder (str): Card holder name
            expiry (str): Expiry date (MM/YY)
            cvv (str): CVV code

        Returns:
            dict: Payment result
        """
        # Validate card details
        is_valid, error_message = self.validate_card(card_number, expiry, cvv)
        if not is_valid:
            return {
                "status": "failed",
                "message": error_message,
                "transaction_id": None,
                "card_type": self.detect_card_type(card_number),
                "gateway_response": json.dumps(
                    {"error": error_message, "timestamp": datetime.now().isoformat()}
                ),
            }

        # Validate amount
        if amount <= 0:
            return {
                "status": "failed",
                "message": "Invalid payment amount",
                "transaction_id": None,
                "card_type": self.detect_card_type(card_number),
                "gateway_response": json.dumps(
                    {"error": "Invalid amount", "timestamp": datetime.now().isoformat()}
                ),
            }

        # Simulate payment processing (with success rate)
        transaction_id = self.generate_transaction_id()
        card_type = self.detect_card_type(card_number)

        # Simulate processing delay
        import time

        time.sleep(random.uniform(0.5, 1.5))

        # Determine if payment succeeds based on success rate
        is_successful = random.random() < self.success_rate

        if is_successful:
            response = {
                "status": "completed",
                "message": "Payment processed successfully",
                "transaction_id": transaction_id,
                "card_type": card_type,
                "amount": amount,
                "gateway_response": json.dumps(
                    {
                        "status": "approved",
                        "transaction_id": transaction_id,
                        "card_type": card_type,
                        "card_last_four": card_number[-4:],
                        "amount": amount,
                        "timestamp": datetime.now().isoformat(),
                        "auth_code": "".join(
                            random.choices(string.ascii_uppercase + string.digits, k=6)
                        ),
                    }
                ),
            }
        else:
            failure_reasons = [
                "Insufficient funds",
                "Transaction declined by bank",
                "Card limit exceeded",
                "Transaction flagged for review",
            ]

            response = {
                "status": "failed",
                "message": random.choice(failure_reasons),
                "transaction_id": transaction_id,
                "card_type": card_type,
                "gateway_response": json.dumps(
                    {
                        "status": "declined",
                        "transaction_id": transaction_id,
                        "error": random.choice(failure_reasons),
                        "timestamp": datetime.now().isoformat(),
                    }
                ),
            }

        return response

    def process_refund(self, transaction_id, amount, reason=""):
        """
        Process refund for a transaction

        Args:
            transaction_id (str): Original transaction ID
            amount (float): Refund amount
            reason (str): Refund reason

        Returns:
            dict: Refund result
        """
        refund_id = "REF" + "".join(random.choices(string.digits, k=12))

        # Simulate refund processing
        import time

        time.sleep(random.uniform(0.5, 1.0))

        # Refunds have high success rate
        is_successful = random.random() < 0.95

        if is_successful:
            return {
                "status": "refunded",
                "message": "Refund processed successfully",
                "refund_id": refund_id,
                "original_transaction_id": transaction_id,
                "amount": amount,
                "gateway_response": json.dumps(
                    {
                        "status": "refunded",
                        "refund_id": refund_id,
                        "original_transaction_id": transaction_id,
                        "amount": amount,
                        "reason": reason,
                        "timestamp": datetime.now().isoformat(),
                    }
                ),
            }
        else:
            return {
                "status": "failed",
                "message": "Refund processing failed",
                "refund_id": None,
                "original_transaction_id": transaction_id,
                "gateway_response": json.dumps(
                    {
                        "status": "failed",
                        "error": "Refund processing error",
                        "timestamp": datetime.now().isoformat(),
                    }
                ),
            }
