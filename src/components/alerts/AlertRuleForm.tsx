"use client";

/**
 * @file AlertRuleForm.tsx
 * @description Alert rule creation form with a plugin-driven condition builder.
 * The plugin list comes from the live plugin registry (plugins declaring
 * `getAlertDefinitions`); operators are constrained to what the selected
 * field's type allows, and value inputs are typed per field type
 * (number / string / boolean).
 * @module src/components/alerts
 */

import { useState } from "react";
import type { AlertOperator } from "@worldwideview/wwv-plugin-sdk";
import type { AlertablePlugin } from "@/lib/alerts/alertablePlugins";
import { getAlertablePlugins } from "@/lib/alerts/alertablePlugins";
import { OPERATOR_LABELS, operatorsForField } from "@/lib/alerts/format";
import { useStore } from "@/core/state/store";
import styles from "./AlertRuleForm.module.css";

export interface AlertRuleFormProps {
    /** Alertable plugins; defaults to the live registry enumeration. */
    plugins?: AlertablePlugin[];
    onCreated?: () => void;
    onCancel?: () => void;
}

interface CreatePayload {
    pluginId: string;
    name: string;
    condition: { field: string; op: AlertOperator; value?: unknown };
}

function firstOperator(field: { type: "number" | "string" | "boolean"; operators?: AlertOperator[] }): AlertOperator {
    return operatorsForField(field)[0];
}

function defaultValueFor(field: { type: "number" | "string" | "boolean" }): string {
    return field.type === "number" ? "0" : field.type === "boolean" ? "true" : "";
}

/**
 * @component AlertRuleForm
 * @description Builds a single-condition alert rule: pick a plugin, then a
 * field exposed by that plugin's AlertFieldDefinitions, an operator valid for
 * the field type, and a typed value. POSTs on save.
 */
export function AlertRuleForm({ plugins: pluginProp, onCreated, onCancel }: AlertRuleFormProps) {
    const createAlert = useStore((s) => s.createAlert);
    // Enumerate the live plugin registry when the caller does not pass a fixed
    // list, so the builder shows whatever alertable plugins are registered.
    const plugins: AlertablePlugin[] = pluginProp ?? getAlertablePlugins();

    const [pluginId, setPluginId] = useState<string>(() => plugins[0]?.id ?? "");
    const selectedPlugin = plugins.find((p) => p.id === pluginId);

    const [fieldKey, setFieldKey] = useState<string>(() => selectedPlugin?.definitions[0]?.key ?? "");
    const selectedField = selectedPlugin?.definitions.find((d) => d.key === fieldKey);

    const [op, setOp] = useState<AlertOperator>(() =>
        selectedField ? firstOperator(selectedField) : "eq",
    );
    const [valueInput, setValueInput] = useState<string>(() =>
        selectedField ? defaultValueFor(selectedField) : "",
    );
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePluginChange = (nextPluginId: string) => {
        const nextPlugin = plugins.find((p) => p.id === nextPluginId);
        if (!nextPlugin) return;
        setPluginId(nextPluginId);
        const nextField = nextPlugin.definitions[0];
        setFieldKey(nextField?.key ?? "");
        setOp(nextField ? firstOperator(nextField) : "eq");
        setValueInput(nextField ? defaultValueFor(nextField) : "");
        setError(null);
    };

    const handleFieldChange = (nextKey: string) => {
        const nextField = selectedPlugin?.definitions.find((d) => d.key === nextKey);
        if (!nextField) return;
        setFieldKey(nextKey);
        setOp(firstOperator(nextField));
        setValueInput(defaultValueFor(nextField));
        setError(null);
    };

    const handleSave = async () => {
        if (!selectedPlugin || !selectedField) {
            setError("Select a plugin and a field first.");
            return;
        }
        if (!selectedPlugin.definitions.some((d) => d.key === fieldKey)) {
            setError("The selected field is not alertable by this plugin.");
            return;
        }
        if (name.trim() === "") {
            setError("Give the rule a name.");
            return;
        }

        if (!operatorsForField(selectedField).includes(op)) {
            setError("The chosen operator is not valid for this field type.");
            return;
        }

        let parsedValue: unknown;
        if (op === "exists") {
            parsedValue = undefined;
        } else if (selectedField.type === "number") {
            parsedValue = Number(valueInput);
            if (valueInput.trim() === "" || Number.isNaN(parsedValue)) {
                setError("Enter a valid number.");
                return;
            }
        } else if (selectedField.type === "boolean") {
            parsedValue = valueInput === "true";
        } else {
            parsedValue = valueInput;
        }

        const payload: CreatePayload = {
            pluginId: selectedPlugin.id,
            name: name.trim(),
            condition:
                op === "exists"
                    ? { field: fieldKey, op }
                    : { field: fieldKey, op, value: parsedValue },
        };

        setSaving(true);
        setError(null);
        try {
            const result = await createAlert(payload);
            if (!result.ok) {
                setError(result.error ?? "Failed to create the rule.");
                return;
            }
            onCreated?.();
        } finally {
            setSaving(false);
        }
    };

    const allowedOperators = selectedField ? operatorsForField(selectedField) : [];
    const showValueInput = selectedField !== undefined && op !== "exists";

    if (plugins.length === 0) {
        return (
          <div className={styles.empty} data-testid="alert-form-empty">
            <p>No plugins with alert definitions are installed.</p>
            <p className={styles.emptyHint}>
              Plugins declare alertable fields via <code>getAlertDefinitions()</code>.
            </p>
            {onCancel && (
              <button className={styles.cancel} onClick={onCancel}>Cancel</button>
            )}
          </div>
        );
    }

    return (
      <form
        className={styles.form}
        data-testid="alert-rule-form"
        onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
            }}
      >
        <div className={styles.fieldRow}>
          <label className={styles.label} htmlFor="alert-rule-name">Rule name</label>
          <input
            id="alert-rule-name"
            className={styles.input}
            type="text"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Big quake in Alaska"
            data-testid="alert-rule-name-input"
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label} htmlFor="alert-rule-plugin">Plugin</label>
          <select
            id="alert-rule-plugin"
            className={styles.input}
            value={pluginId}
            onChange={(e) => handlePluginChange(e.target.value)}
            data-testid="alert-rule-plugin-select"
          >
            {plugins.map((plugin) => (
              <option key={plugin.id} value={plugin.id}>{plugin.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label} htmlFor="alert-rule-field">Field</label>
          <select
            id="alert-rule-field"
            className={styles.input}
            value={fieldKey}
            onChange={(e) => handleFieldChange(e.target.value)}
            data-testid="alert-rule-field-select"
          >
            {selectedPlugin?.definitions.map((definition) => (
              <option key={definition.key} value={definition.key}>{definition.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label} htmlFor="alert-rule-op">Condition</label>
          <select
            id="alert-rule-op"
            className={styles.input}
            value={op}
            onChange={(e) => {
                    setOp(e.target.value as AlertOperator);
                    setError(null);
                }}
            data-testid="alert-rule-op-select"
          >
            {allowedOperators.map((allowed) => (
              <option key={allowed} value={allowed}>{OPERATOR_LABELS[allowed]}</option>
            ))}
          </select>
        </div>

        {showValueInput && selectedField && (
          <div className={styles.fieldRow}>
            <label className={styles.label} htmlFor="alert-rule-value">
              {selectedField.type === "boolean" ? "Value" : "Value"}
            </label>
            {selectedField.type === "boolean" ? (
              <select
                id="alert-rule-value"
                className={styles.input}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                data-testid="alert-rule-value-select"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                id="alert-rule-value"
                className={styles.input}
                type={selectedField.type === "number" ? "number" : "text"}
                step={selectedField.type === "number" ? "any" : undefined}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                data-testid="alert-rule-value-input"
              />
            )}
          </div>
        )}

        {error && <p className={styles.error} data-testid="alert-form-error">{error}</p>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.save}
            disabled={saving}
            data-testid="alert-rule-save"
          >
            {saving ? "Saving..." : "Create Rule"}
          </button>
          {onCancel && (
            <button
              type="button"
              className={styles.cancel}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    );
}