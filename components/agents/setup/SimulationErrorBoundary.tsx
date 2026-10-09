"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export default class SimulationErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || "The simulation view hit an unexpected error." };
  }

  render() {
    if (this.state.message) {
      return (
        <p className="sim-error" role="alert">
          {this.state.message} Close and open the simulation again.
        </p>
      );
    }
    return this.props.children;
  }
}
