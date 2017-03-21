//Data Transfer class for example API. 
// Used for deseralization/serialization and mapping to SOBJECT
public class RestClient1DTO {
    
    //ROOT Objects
    public class Post
    {
        public Integer userId { get; set; }
        public Integer id { get; set; }
        public String title { get; set; }
        public String body { get; set; }

        public Post__c toSObject(){
            Contact author = new Contact(
                Author_Id__c = String.valueOf(userId)
            );

            return new Post__c(
                Name = String.valueOf(id),
                Author__r = author,
                Title__c = title,
                Body__c = body
            );
        }
    }

    public class User
    {
        public Integer id { get; set; }
        public String name { get; set; }
        public String username { get; set; }
        public String email { get; set; }
        public Address address { get; set; }
        public String phone { get; set; }
        public String website { get; set; }
        public Company company { get; set; }
    
        public Contact toSObject(){
            return new Contact(
                Author_Id__c = String.valueOf(id),
                LastName = name,
                Email = email,
                Phone = phone,
                MailingStreet = address.street,
                MailingCity = address.city,
                MailingPostalCode = address.zipcode
            );
        }
    }

    //Child Objects for User
    public class Geo
    {
        public String lat { get; set; }
        public String lng { get; set; }
    }

    public class Address
    {
        public String street { get; set; }
        public String suite { get; set; }
        public String city { get; set; }
        public String zipcode { get; set; }
        public Geo geo { get; set; }
    }

    public class Company
    {
        public String name { get; set; }
        public String catchPhrase { get; set; }
        public String bs { get; set; }
    }

}