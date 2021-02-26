/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
global with sharing class StatusCardController {
    @AuraEnabled
    public static StatusCard__c getUserData( String userId ){
        return [SELECT Id, User__c, Data__c FROM StatusCard__c WHERE User__c =: userId LIMIT 1];
    }

    @AuraEnabled
    public static String saveUserData( StatusCard__c record ){
        if (Schema.sObjectType.StatusCard__c.isUpdateable() && Schema.sObjectType.StatusCard__c.isCreateable()) {
            try {
                upsert record;
                return record.Id;
            } catch (Exception e) {
                return 'NG';
            }
        } else {
            return 'NG';
        }
    }

    public static String getObjectName( String objname ) {
        for ( Schema.SObjectType obj : Schema.getGlobalDescribe().values() ) {
            Schema.DescribeSObjectResult objDescription = obj.getDescribe();
            if( objDescription.getName() == objname ) {
                return objDescription.getLabel();
            }
        }
        return objname;
    }

    @AuraEnabled
    public static String getListViews() {
        List<Object> ret = new List<Object>();
        Map<String, String> desMap = new Map<String, String>();

        for ( Schema.SObjectType obj : Schema.getGlobalDescribe().values() ) {
            Schema.DescribeSObjectResult objDescription = obj.getDescribe();
            desMap.put(objDescription.getName(), objDescription.getLabel());
        }
        for (ListView listViewRecord: [SELECT Id, Name, SobjectType FROM ListView WHERE IsSoqlCompatible = true ORDER BY SobjectType]) {
            Map<String, Object> recordMap = new Map<String, Object>();
            recordMap.put('Id', listViewRecord.Id);
            recordMap.put('Name', listViewRecord.Name);
            recordMap.put('SobjectType', listViewRecord.SobjectType);
            recordMap.put('Label', desMap.get(listViewRecord.SobjectType));
            ret.add(recordMap);
        }

        return JSON.serialize(ret);
    }

    public static String fetchUserSessionId(){
        String sessionId = '';
        PageReference reportPage = Page.GetSessionIdVfForStatusCard;

        if (!Test.isRunningTest()) {
            String vfContent = reportPage.getContent().toString();
            Integer startP = vfContent.indexOf('Start_Of_Session_Id') + 'Start_Of_Session_Id'.length(),
            endP = vfContent.indexOf('End_Of_Session_Id');
            sessionId = vfContent.substring(startP, endP);
        }

        return sessionId;
    }

    @AuraEnabled
    public static String getListRecords(String objectName, String listViewId) {
        Map<String, Object> ret = new Map<String, Object>();
        String getObjectLabel =  getObjectName(objectName);
        ret.put('label', getObjectLabel);
        String authToken = fetchUserSessionId();
        String filterQueryMine = '';
        String filterQuery = '';
        List<sObject> records = new List<sObject>();
        ret.put('size', NULL);

        String ep = URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v50.0/sobjects/'+objectName+'/listviews/'+listViewId+'/results?limit=2000';
        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setHeader('Authorization','Bearer '+authToken);
        req.setEndpoint(ep);
        HttpResponse response = new Http().send(req);

        Map<String, Object> requestBody = new Map<String, Object>();
        Integer statusCode = response.getStatusCode();
        if (statusCode == 200) {
            requestBody = (Map<String, Object>)JSON.deserializeUntyped(response.getBody());
            ret.put('size', requestBody.get('size'));
        } else {
            System.debug('Error: ' + statusCode + ' : ' + response.getBody());
        }

        return JSON.serialize(ret);
    }
}