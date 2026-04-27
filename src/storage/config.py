"""
Configuration storage functions.

Only user overrides are stored. The full effective config is computed by
merging overrides over data/default/config.json via core_logic.get_effective_config().
"""

from .base import _read, _write


def get_config() -> dict:
    """Get user configuration overrides. Empty dict means use all defaults."""
    return _read("config") or {}


def set_config(config: dict) -> dict:
    """Validate and save user configuration overrides."""
    validated = validate_config(config)
    _save_config_history(validated)
    _write("config", validated)
    return validated


def get_config_history() -> list:
    """Get configuration change history."""
    return _read("config_history", [])


def reset_config() -> dict:
    """Reset to defaults by clearing all user overrides."""
    _write("config", {})
    from core_logic import get_effective_config
    return get_effective_config({})


def revert_config(index: int) -> dict:
    """Revert configuration to a specific history entry."""
    history = get_config_history()
    if not history or index >= len(history):
        raise ValueError("Invalid history index")
    entry = history[index]
    config = entry["config"] if isinstance(entry, dict) and "config" in entry else entry
    set_config(config)
    return config


def get_effective_config(config: dict = None) -> dict:
    """Get the full effective configuration with defaults applied."""
    if config is None:
        config = get_config()
    from core_logic import get_effective_config as _core
    return _core(config)


def validate_config(config: dict) -> dict:
    """
    Validate configuration overrides. All fields are optional.
    Only validates fields that are present.
    """
    if not isinstance(config, dict):
        raise ValueError("Config must be a dictionary")

    # muscle_weights
    mw = config.get("muscle_weights")
    if mw is not None:
        if not isinstance(mw, dict):
            raise ValueError("muscle_weights must be a dictionary")
        for muscle, w in mw.items():
            if not isinstance(w, (int, float)) or w <= 0:
                raise ValueError(f"muscle_weights[{muscle}] must be a positive number")

    # fatigue_decay
    fd = config.get("fatigue_decay")
    if fd is not None:
        if not isinstance(fd, (int, float)) or not (0 < fd <= 1):
            raise ValueError("fatigue_decay must be a float in (0, 1]")

    # target_exercise_count
    tec = config.get("target_exercise_count")
    if tec is not None:
        if not isinstance(tec, int) or tec < 1:
            raise ValueError("target_exercise_count must be a positive integer")

    # max_difficulty_allowed
    mda = config.get("max_difficulty_allowed")
    if mda is not None:
        if not isinstance(mda, int) or mda < 1:
            raise ValueError("max_difficulty_allowed must be a positive integer")

    # pattern_limits
    pl = config.get("pattern_limits")
    if pl is not None:
        if not isinstance(pl, dict):
            raise ValueError("pattern_limits must be a dictionary")
        for pattern, lim in pl.items():
            if not isinstance(lim, int) or lim < 0:
                raise ValueError(f"pattern_limits[{pattern}] must be a non-negative integer")

    # threshold scalars
    for field in ("muscle_usage_limit", "sore_block_threshold",
                  "fatigue_block_threshold", "fatigue_block_contribution",
                  "sore_penalty_factor"):
        v = config.get(field)
        if v is not None and not isinstance(v, (int, float)):
            raise ValueError(f"{field} must be a number")

    # weekly_targets
    wt = config.get("weekly_targets")
    if wt is not None:
        if not isinstance(wt, dict):
            raise ValueError("weekly_targets must be a dictionary")
        for muscle, target in wt.items():
            if not isinstance(target, dict):
                raise ValueError(f"weekly_targets[{muscle}] must be an object")
            for key in ("min", "max"):
                if key in target and not isinstance(target[key], (int, float)):
                    raise ValueError(f"weekly_targets[{muscle}][{key}] must be a number")

    return config


def _save_config_history(config: dict) -> None:
    """Append current config to history (capped at 50 entries)."""
    from datetime import datetime
    history = get_config_history()
    history.append({"config": config, "timestamp": datetime.now().isoformat()})
    if len(history) > 50:
        history = history[-50:]
    _write("config_history", history)
