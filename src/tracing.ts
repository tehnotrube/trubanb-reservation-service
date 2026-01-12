import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Only enable tracing if OTEL endpoint is configured
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;

if (otlpEndpoint && otlpEndpoint.trim() !== '') {
  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'reservation-service',
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Automatically instrument HTTP, Express, and other libraries
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true, // PostgreSQL instrumentation
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();
  console.log('OpenTelemetry tracing enabled');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
} else {
  console.log('OpenTelemetry tracing disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}

export default sdk;
