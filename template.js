const getcontainerVersion = require('getContainerVersion');
const getAllEventData = require('getAllEventData');
const getRequestHeader = require('getRequestHeader');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeTableMap = require('makeTableMap');
const sendHttpRequest = require('sendHttpRequest');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const containerVersion = getcontainerVersion();
const traceId = getRequestHeader('trace-id');
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();

let apiUrl, method, eventName, requestBody;

if (data.action === 'email') {
  apiUrl = '/mail/send';
  eventName = 'Email';
  method = 'POST';

  requestBody = {
    personalizations: [
      {
        to: [{ email: data.emailTo }]
      }
    ],
    from: { email: data.emailFrom },
    subject: data.emailSubject,
    content: [{ type: 'text/html', value: data.emailText }]
  };
} else {
  apiUrl = '/marketing/contacts';
  eventName = 'Contact';
  method = 'PUT';

  requestBody = {
    contacts: [
      data.contactDefault && data.contactDefault.length
        ? makeTableMap(data.contactDefault, 'name', 'value')
        : {}
    ]
  };

  requestBody.contacts[0].email = data.contactEmail;

  if (data.contactLists) {
    requestBody.list_ids = data.contactLists.split(',');
  }

  if (data.contactCustom && data.contactCustom.length) {
    requestBody.contacts[0].custom_fields = makeTableMap(data.contactCustom, 'name', 'value');
  }
}

const requestUrl = 'https://api.sendgrid.com/v3' + apiUrl;

if (isLoggingEnabled) {
  logToConsole(
    JSON.stringify({
      Name: 'SendGrid',
      Type: 'Request',
      TraceId: traceId,
      EventName: eventName,
      RequestMethod: method,
      RequestUrl: requestUrl,
      RequestBody: requestBody
    })
  );
}

sendHttpRequest(
  requestUrl,
  (statusCode, headers, body) => {
    if (isLoggingEnabled) {
      logToConsole(
        JSON.stringify({
          Name: 'SendGrid',
          Type: 'Response',
          TraceId: traceId,
          EventName: eventName,
          ResponseStatusCode: statusCode,
          ResponseHeaders: headers,
          ResponseBody: body
        })
      );
    }

    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  },
  {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + data.apiKey
    }
  },
  JSON.stringify(requestBody)
);

/*==============================================================================
  Helpers
==============================================================================*/

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function determinateIsLoggingEnabled() {
  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}
