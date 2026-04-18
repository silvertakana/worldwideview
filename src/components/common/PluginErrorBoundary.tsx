"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  pluginId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

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
