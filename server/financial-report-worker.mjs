import { handleFinancialReportRequest } from './financial-report-api.mjs';

export default {
  fetch(request) {
    return handleFinancialReportRequest(request);
  },
};
