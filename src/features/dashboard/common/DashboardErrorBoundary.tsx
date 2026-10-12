import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard section error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Section Error"
          body={
            this.state.error?.message ||
            "An unexpected error occurred while displaying this section."
          }
          retry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }
    return this.props.children;
  }
}

export default DashboardErrorBoundary;
