"""Test Scenarios Module"""

from app.data_injection.scenarios.basic_flow import create_basic_flow_scenario


def load_scenario(injector, scenario_name):
    """
    Load a pre-defined test scenario

    Args:
        injector: DataInjector instance
        scenario_name (str): Name of scenario to load
    """
    scenarios = {"basic_flow": create_basic_flow_scenario}

    if scenario_name in scenarios:
        scenarios[scenario_name](injector)
    else:
        raise ValueError(f"Unknown scenario: {scenario_name}")
