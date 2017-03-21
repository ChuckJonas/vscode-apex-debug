//Client for retrieving Authors and Posts from fake API
public class RestClient1 {
	
    //---CONSTANTS---
    private static final String HOST = 'http://jsonplaceholder.typicode.com';

    //map that defines eligible resources and their endpoints based on class type
    @testvisible
    private static final Map<Type,String> RESOURCE_MAP = new Map<Type,String>{
        List<RestClient1DTO.User>.class => HOST + '/users',
        List<RestClient1DTO.Post>.class => HOST + '/posts'
    };

    //--- PROPERTIES ---
    public List<RestClient1DTO.User> users {get; private set;}
    public List<RestClient1DTO.Post> posts {get; private set;}

    //--- PUBLICS ---
    public void retrieveUsers(){
        users = (List<RestClient1DTO.User>) get(List<RestClient1DTO.User>.class);
    }

    public void retrievePosts(){
        posts = (List<RestClient1DTO.Post>) get(List<RestClient1DTO.Post>.class);
    }

    //--- PRIVATES ---
    private Object get(Type type){
        if(!RESOURCE_MAP.containsKey(type)){
            throw new APIException('Type not mapped to resource endpoint');
        }

        String endpoint = RESOURCE_MAP.get(type);

        HttpRequest req = new HttpRequest();
        req.setHeader('Content-Type', 'application/json');
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        req.setTimeout(12000);

        Http http = new Http();
        HttpResponse response = http.send(req);
        return JSON.deserialize(response.getBody(), type);
    }

    public class APIException extends Exception{}
}