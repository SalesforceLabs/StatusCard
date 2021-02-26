/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
@isTest
private class StatusCardControllerTest {

    @isTest
    static void main() {
        Test.startTest();

        String uniqueUserName = 'standarduser' + DateTime.now().getTime() + '@testorg.com';
        Profile p = [SELECT Id FROM Profile WHERE Name IN ('Standard User', '標準ユーザ')];
        User u = new User(
            Alias = 'standt',
            Email='standarduser@testorg.com',
            EmailEncodingKey='UTF-8',
            LastName='Testing',
            LanguageLocaleKey='en_US',
			LocaleSidKey='en_US',
            ProfileId = p.Id,
            TimeZoneSidKey='America/Los_Angeles',
            UserName=uniqueUserName
        );
        insert u;

        StatusCard__c StatusCardRecord = new sttscard__StatusCard__c(
            sttscard__User__c = u.Id
        );
        insert StatusCardRecord;

        StatusCardController.getUserData(u.Id);
        StatusCardController.getListViews();
        String recordId = StatusCardController.saveUserData(StatusCardRecord);
        Test.stopTest();

        System.assertEquals(recordId, StatusCardRecord.Id);
    }

    @isTest
    static void StatusCardControllerCalloutTest() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new StatusCardTest_HttpMock());
        //Listview listview = [SELECT Id  FROM ListView WHERE SobjectType = 'Account'];
        String retVal = StatusCardController.getListRecords('Account', 'AllAccounts');
        Test.stopTest();
        Map<String, Object> retMap = (Map<String, Object>)JSON.deserializeUntyped(retVal);

        System.assertNotEquals(retMap.get('size'), 0);
    }
}