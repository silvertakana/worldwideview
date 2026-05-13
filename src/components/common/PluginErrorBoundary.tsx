/**
 * @file PluginErrorBoundary.tsx
 * @description Fault-isolation container for dynamic plugin components.
 * Ensures a single plugin crash does not bring down the entire application.
 * @module src/components/common
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

/**
 * Props for the PluginErrorBoundary component.
 */
interface Props {
  /** The unique identifier of the plugin being wrapped. */
  pluginId: string;
  /** The child components to monitor for render errors. */
  children: ReactNode;
}

/**
 * State for the PluginErrorBoundary.
 */
interface State {
  /** Whether an error has been caught in the current lifecycle. */
  hasError: boolean;
}

/**
 * @component PluginErrorBoundary
 * @description A standard React error boundary used to isolate failures in third-party 
 * or dynamic plugin components. When a crash occurs, the boundary renders 
 * nothing (null), allowing the rest of the UI (sidebar, globe) to remain functional.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PluginErrorBoundary] Plugin component '${this.props.pluginId}' crashed during render and was isolated:`, error);
  }

  public render() {
    if (this.state.hasError) {
      // Return null so the rest of the application can continue running
      return null;
    }

    return this.props.children;
  }
}
