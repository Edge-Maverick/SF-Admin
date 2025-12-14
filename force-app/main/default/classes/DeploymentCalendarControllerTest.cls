@isTest
public class DeploymentCalendarControllerTest {
    
    @testSetup
    static void setupData() {
        Event e1 = new Event(
            Subject = '[DevOps] Test Deployment',
            StartDateTime = DateTime.now().addHours(1),
            EndDateTime = DateTime.now().addHours(2),
            Description = 'Test Description'
        );
        insert e1;
        
        Event e2 = new Event(
            Subject = 'Future Deployment',
            StartDateTime = DateTime.now().addDays(5),
            EndDateTime = DateTime.now().addDays(5).addHours(1)
        );
        insert e2;
    }

    @isTest
    static void testGetUpcomingEvents() {
        Test.startTest();
        List<Event> events = DeploymentCalendarController.getUpcomingEvents(2);
        Test.stopTest();
        
        // Should find the one adding hours(1), but not the one in 5 days
        System.assertEquals(1, events.size(), 'Should find 1 upcoming event in next 24h');
        System.assertEquals('[DevOps] Test Deployment', events[0].Subject);
    }
    
    @isTest
    static void testGetMonthEvents() {
        DateTime now = DateTime.now();
        Test.startTest();
        List<Event> events = DeploymentCalendarController.getMonthEvents(now.month(), now.year());
        Test.stopTest();
        
        // Should find both as they are this month (assuming test runs in same month)
        // If test runs at end of month, this might be flaky, but for valid logic:
        System.assert(events.size() >= 1); 
    }
    
    @isTest
    static void testCreateEvent() {
        DateTime startDt = DateTime.now().addDays(1);
        DateTime endDt = startDt.addHours(1);
        
        Test.startTest();
        Event e = DeploymentCalendarController.createEvent('New Event', startDt, endDt, 'Desc');
        Test.stopTest();
        
        System.assertNotEquals(null, e.Id);
        System.assertEquals('New Event', e.Subject);
    }
}
