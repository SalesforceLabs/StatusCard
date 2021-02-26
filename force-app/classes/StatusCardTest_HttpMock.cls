/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
@isTest
global class StatusCardTest_HttpMock implements HttpCalloutMock {
    global HTTPResponse respond(HTTPRequest req) {
        Map<String, Object> DummyData = new Map<String, Object>();
        DummyData.put('query', 'SELECT Id FROM Account USING SCOPE mine WHERE Name != null ORDER BY DESC');

        HttpResponse response = new HttpResponse();
        response.setHeader('Content-Type', 'application/json');
        response.setStatusCode(200);
        response.setBody(JSON.serialize(DummyData));

        return response;
    }
}