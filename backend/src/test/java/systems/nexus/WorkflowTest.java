package systems.nexus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class WorkflowTest {
 org.springframework.transaction.support.TransactionTemplate tx; Store store; WorkflowService service; ObjectMapper json=new ObjectMapper();
 @BeforeEach void setup() throws Exception { var ds=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""); new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds); tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds)); var db=new JdbcTemplate(ds); store=new Store(db,json); service=new WorkflowService(db,store); graph(List.of("a","b")); }
 void graph(List<String> ids) throws Exception {store.persist(new Model.Graph(ids.stream().map(id->new Model.Node(id,"Person",id,Map.<String,Object>of())).toList(),List.of(),List.of(),List.of(),json.readTree("{\"alerts\":[{\"id\":\"alert\"}]}"),true,List.of()));}
 @Test void persistsOriginalNotesAcrossMergeAndUndoAndReset() throws Exception {var note=service.addNote("b","hello","alice");store.state("aliases",Map.of("b","a"));graph(List.of("a"));assertEquals(note,service.notes("a").get(0));store.state("aliases",Map.of());graph(List.of("a","b"));assertTrue(service.notes("a").isEmpty());assertEquals("b",service.notes("b").get(0).entityId());store.reset();assertTrue(service.workflow("alice").notes().isEmpty());}
 @Test void malformedWorkflowBodiesReturn400() throws Exception {
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new WorkflowController(service)).setControllerAdvice(new ApiErrors()).build();
  for(String body:List.of("{}","{\"text\":null}","{\"text\":\" \"}"))
   mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/entities/a/notes").requestAttr("nexus.user","alice").contentType("application/json").content(body)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/entities/a/watchlist").contentType("application/json").content("{}")).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/alerts/alert/triage").contentType("application/json").content("{\"status\":\"Verified\"}")).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
 }
 @Test void validatesNotesAndIsolatesWatchlists(){assertThrows(IllegalArgumentException.class,()->service.addNote("a"," ","alice"));assertThrows(IllegalArgumentException.class,()->service.addNote("a","x".repeat(4001),"alice"));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.addNote("missing","hi","alice"));service.watch("a",true,"alice");service.watch("a",true,"alice");assertEquals(List.of("a"),service.watchlist("alice"));assertTrue(service.watchlist("bob").isEmpty());service.watch("a",false,"alice");assertTrue(service.watchlist("alice").isEmpty());}
 @Test void concurrentNotesKeepAuditChainValidAndRollbackAtomically() throws Exception {var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var gate=new java.util.concurrent.CountDownLatch(1);try{java.util.concurrent.Callable<Void> change=()->{gate.await();tx.execute(t->{service.addNote("a","review","alice");return null;});return null;};var a=pool.submit(change);var b=pool.submit(change);gate.countDown();a.get();b.get();assertEquals(true,store.verifyAuditChain().get("valid"));assertEquals(2,service.notes("a").size());assertEquals(2,store.audit().size());assertThrows(IllegalStateException.class,()->tx.execute(t->{service.addNote("a","rollback","alice");throw new IllegalStateException("rollback");}));assertEquals(2,service.notes("a").size());assertEquals(2,store.audit().size());assertEquals("alice",store.audit().get(0).get("userId"));}finally{pool.shutdownNow();}}
 @Test void concurrentTriageCommitsExactlyOneUpdate() throws Exception { var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var gate=new java.util.concurrent.CountDownLatch(1);try{java.util.concurrent.Callable<Integer> change=()->{gate.await();try{return tx.execute(t->{service.triage("alert","Under Review",0,"alice");return 200;});}catch(org.springframework.web.server.ResponseStatusException ex){return ex.getStatusCode().value();}};var a=pool.submit(change);var b=pool.submit(change);gate.countDown();var codes=new java.util.ArrayList<>(List.of(a.get(),b.get()));java.util.Collections.sort(codes);assertEquals(List.of(200,409),codes);assertEquals(1,service.workflow("alice").triage().get(0).version());}finally{pool.shutdownNow();}}
 @Test void triageRejectsStaleVersions(){assertEquals(1,service.triage("alert","Under Review",0,"alice").version());var ex=assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.triage("alert","Verified",0,"bob"));assertEquals(409,ex.getStatusCode().value());assertEquals(2,service.triage("alert","Verified",1,"bob").version());assertThrows(IllegalArgumentException.class,()->service.triage("alert","Guilty",2,"bob"));}
 @Test void hidesObsoleteWorkflowAndResetClearsIt() throws Exception {
  service.addNote("b","retained note","alice");service.watch("b",true,"alice");service.triage("alert","Verified",0,"alice");
  store.persist(new Model.Graph(List.of(new Model.Node("a","Person","a",Map.of())),List.of(),List.of(),List.of(),json.createObjectNode(),true,List.of()));
  var obsolete=service.workflow("alice");assertTrue(obsolete.notes().isEmpty());assertTrue(obsolete.watchlist().isEmpty());assertTrue(obsolete.triage().isEmpty());
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.triage("alert","Dismissed",1,"alice"));
  graph(List.of("a","b"));assertEquals(1,service.notes("b").size());assertEquals(List.of("b"),service.watchlist("alice"));assertEquals("Verified",service.workflow("alice").triage().get(0).status());
  store.reset();graph(List.of("a","b"));var cleared=service.workflow("alice");assertTrue(cleared.notes().isEmpty());assertTrue(cleared.watchlist().isEmpty());assertTrue(cleared.triage().isEmpty());
 }
}


