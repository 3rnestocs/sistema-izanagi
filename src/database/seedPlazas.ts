import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const datosExcel = `
Nombre de Guía de Habilidad	Subcategoría	Costo Cupos	Plazas Totales	Plazas Ocupadas	Estado	Usuarios Poseedores	Extras	Stat Afectado	Valor	Rasgo Gratis	Rasgo Gratis
Katon	Elementos	2	0	3	Sin plazas	Gbus, Dom, Bill				
Fuuton	Elementos	2	0	2	Sin plazas	Gamberrodan, Bill				
Raiton	Elementos	2	0	1	Sin plazas	Heimdal				
Doton	Elementos	2	0	1	Sin plazas	wadysh				
Suiton	Elementos	2	0	5	Sin plazas	Hoshiko, Heimdal, wadysh, Sheepie, Acerola				
Iryouninjutsu	Elementos	2	0	0	Sin plazas					
Inton Genjutsu	Elementos	2	0	0	Sin plazas					
Jinton Velocidad	Elementos	3	1	1	Ocupado	Joaco				
Kouton	Elementos	3	1	0	Disponible					
Meiton	Elementos	5	1	1	Ocupado	Joaco				
Hyouton	Elementos	5	1	0	Disponible		Suiton, Fuuton			
Ranton	Elementos	5	1	1	Ocupado	Heimdal	Suiton, Raiton			
Shakuton	Elementos	5	1	0	Disponible		Fuuton, Katon			
Jiton Sakin	Elementos	5	1	0	Disponible		Fuuton, Doton			
Jiton Satetsu	Elementos	5	1	0	Disponible		Fuuton, Doton			
Jiton Magnético	Elementos	5	1	0	Disponible		Fuuton, Doton			
Bakuton	Elementos	5	1	0	Disponible		Raiton, Doton			
Youton Ácido	Elementos	5	1	0	Disponible		Katon, Doton			
Youton Goma	Elementos	5	1	0	Disponible		Katon, Doton			
Youton Cal	Elementos	5	1	0	Disponible		Katon, Doton			
Futton	Elementos	5	1	0	Disponible		Katon, Suiton			
Shouton	Elementos	5	1	0	Disponible		Doton			
Mokuton (Yamato)	Elementos	5	1	0	Disponible		Doton, Suiton			
Taiton	Elementos	5	1	0	Disponible		Fuuton			
Cinco elementos	Elementos	7	1	0	Disponible					
Mokuton	Elementos	7	1	1	Ocupado	wadysh	Doton, Suiton			
Jinton Polvo	Elementos	7	1	1	Ocupado	Gamberrodan	Fuuton, Katon, Doton			
Uchiha Ichizoku	Clanes	8	3	2	Disponible	Gbus, Dom	Katon			Presteza
Uzumaki Ichizoku	Clanes	8	3	0	Disponible		Fuuinjutsu			
Hyuuga Ichizoku	Clanes	8	3	1	Disponible	Katarzis				Noble
Houzuki Ichizoku	Clanes	8	3	1	Disponible	Sheepie	Suiton			
Kaguya Ichizoku	Clanes	8	1	0	Disponible					
Chinoike Ichizoku	Clanes	8	3	0	Disponible					
Chakra del meteorito	Clanes	8	3	0	Disponible			Chakra	2	
Sacerdotisa	Clanes	8	1	0	Disponible					
Hagoromo Ichizoku	Clanes	7	3	1	Disponible	Bill				Presteza
Jyuugo Ichizoku	Clanes	7	1	0	Disponible					Solitario
Tsuchigumo Ichizoku	Clanes	7	3	0	Disponible					
Yuki Ichizoku	Clanes	7	3	0	Disponible		Hyouton			
Aburame Ichizoku	Clanes	6	3	0	Disponible					Protector
Nara Ichizoku	Clanes	6	3	0	Disponible					Astuto
Akimichi Ichizoku	Clanes	6	3	0	Disponible					
Yamanaka Ichizoku	Clanes	6	3	0	Disponible					
Inuzuka Ichizoku	Clanes	6	3	0	Disponible					Impulsivo
Samurai del Hierro	Clanes	6	3	0	Disponible					Honorable
Senju Ichizoku	Clanes	6	3	1	Disponible	wadysh				Presteza, Voluntad de Fuego
Kurama Ichizoku	Clanes	6	3	0	Disponible					
Sarutobi Ichizoku	Clanes	5	3	0	Disponible		Katon			Presteza, Voluntad de Fuego
Shimura Ichizoku	Clanes	5	3	0	Disponible					Presteza, Voluntad de Fuego
Hoshigaki Ichizoku	Clanes	5	3	1	Disponible	Acerola	Suiton, Kenjutsu			Presteza
Kazekage Ichizoku	Clanes	5	3	0	Disponible					Presteza
Hooki Ichizoku	Clanes	5	3	0	Disponible		Iryouninjutsu			
Heredero de Rouran	Clanes	5	1	1	Ocupado	Pandora1				
Monjes Hooriki	Clanes	5	3	0	Disponible					
Yotsuki Ichizoku	Clanes	5	3	1	Disponible	Heimdal				Presteza
Kohaku Ichizoku	Clanes	5	3	0	Disponible					Presteza
Funato Ichizoku	Clanes	6	3	1	Disponible	Hoshiko	Suiton			
Hatake Ichizoku	Clanes	3	3	1	Disponible	Joaco	Kenjutsu			Precavido
Kamizuru Ichizoku	Clanes	5	3	0	Disponible					
Iburi Ichizoku	Clanes	5	3	0	Disponible					Discriminado
Yomi Ichizoku	Clanes	5	3	0	Disponible		Iryouninjutsu, Experimentación Química			
Guardianes del Hozukijou	Clanes	5	3	0	Disponible		Katon			
Fuuma Ichizoku	Clanes	5	3	0	Disponible					
Yota Ichizoku	Clanes	5	3	0	Disponible					
Shiin Ichizoku	Clanes	5	3	0	Disponible		Inton Genjutsu			
Kodon Ichizoku	Clanes	5	3	0	Disponible					
Zetsu Blanco	Habilidades Especiales	15	1	0	Disponible					
Zetsu Espiral	Habilidades Especiales	15	1	0	Disponible					
Zetsu Negro	Habilidades Especiales	15	1	0	Disponible					
Kimera no Jutsu	Habilidades Especiales	10	1	0	Disponible					
Rinnegan	Habilidades Especiales	10	1	1	Ocupado	Erebvs		Chakra	4	
Kibaku Nendo	Habilidades Especiales	7	1	0	Disponible					
Gouken Taijutsu	Habilidades Especiales	7	3	0	Disponible					
Piedra de Gelel	Habilidades Especiales	7	2	0	Disponible					
Jiongu	Habilidades Especiales	7	1	0	Disponible					
Origami	Habilidades Especiales	7	1	0	Disponible					
Ranmaru	Habilidades Especiales	6	1	0	Disponible		Inton Genjutsu			
Kinjutsu de Iwagakure	Habilidades Especiales	5	1	0	Disponible					
Gemelo parásito	Habilidades Especiales	5	1	0	Disponible					
Inki	Habilidades Especiales	5	2	0	Disponible					
Habilidad Kugutsu	Habilidades Especiales	5	3	0	Disponible					
Akurobatto	Habilidades Especiales	5	1	0	Disponible					
Nintaijutsu	Habilidades Especiales	5	1	0	Disponible					
Muon no Ken	Habilidades Especiales	5	2	0	Disponible					
Shikei Seppun	Habilidades Especiales	5	1	0	Disponible					
Shabondama	Habilidades Especiales	5	1	1	Ocupado	Sheepie				
Watari	Habilidades Especiales	4	3	0	Disponible					
Kyodai Sensu	Habilidades Especiales	3	3	0	Disponible					
Clarividencia	Habilidades Especiales	3	1	0	Disponible					
Reibi	Habilidades Especiales	3	1	0	Disponible			Chakra	3	
Nue	Habilidades Especiales	3	1	0	Disponible			Chakra	1	
Habilidad Arácnida	Habilidades Especiales	3	3	0	Disponible					
Hana	Habilidades Especiales	3	3	0	Disponible					
Suna no Tate	Habilidades Especiales	1	1	1	Ocupado	Pandora1				
Maestría en clones	Habilidades Especiales	5	1	0	Disponible					
Jougan	Habilidades Especiales	1	1	1	Ocupado	Bill				
Ichibi	Bijuu	7	1	1	Ocupado	Pandora1	Sabaku	Chakra	4	
Nibi	Bijuu	5	1	0	Disponible		Katon	Chakra	4	
Sanbi	Bijuu	5	1	1	Ocupado	Acerola	Suiton	Chakra	4	
Yonbi	Bijuu	7	1	0	Disponible		Youton Ácido	Chakra	4	
Gobi	Bijuu	7	1	0	Disponible		Futton	Chakra	4	
Rokubi	Bijuu	5	1	1	Ocupado	Hoshiko	Suiton	Chakra	4	
Nanabi	Bijuu	5	1	1	Ocupado	Gamberrodan		Chakra	4	
Hachibi	Bijuu	5	1	1	Ocupado	Heimdal		Chakra	4	
Kyuubi	Bijuu	7	1	0	Disponible			Chakra	4	
Kyuubi Oscuro	Bijuu	7	1	0	Disponible			Chakra	4	
Jinchuurikimodoki	Bijuu	3	1	0	Disponible			Chakra	3	
Humano Sintético	Potenciadores	5	1	0	Disponible			Chakra	1	
Reencarnación de Indra	Potenciadores	1	1	1	Ocupado	Dom		Chakra	2	
Reencarnación de Asura	Potenciadores	1	1	0	Disponible			Chakra	2	
Descendiente de Hagoromo	Potenciadores	1	2	0	Disponible			Chakra	2	
Chakra de Hamura	Potenciadores	1	1	0	Disponible			Chakra	3	
Sennin Moudo de Hashirama	Potenciadores	1	1	0	Disponible					
Byakugou no In	Potenciadores	1	1	0	Disponible					
Infuuin: Kai	Potenciadores	1	1	0	Disponible					
Jashin	Habilidades Secundarias	4	1	0	Disponible					
Hiraishin no Jutsu	Habilidades Secundarias	5	1	0	Disponible					
Kanchi no jutsu	Habilidades Secundarias	4	3	0	Disponible					
Detección en agua	Habilidades Secundarias	3	1	0	Disponible					
Kekkai Tengai Houjin	Habilidades Secundarias	3	1	0	Disponible					
Sello Hexagramal Sensorial	Habilidades Secundarias	3	1	0	Disponible					
Tomegane no Jutsu	Habilidades Secundarias	3	1	0	Disponible					
Detección por contacto	Habilidades Secundarias	3	1	0	Disponible					
Especialización en Shunshin no Jutsu	Habilidades Secundarias	3	1	0	Disponible					
Bukijutsu	Habilidades Secundarias	3	3	0	Disponible					
Kenjutsu	Habilidades Secundarias	3	3	2	Disponible	Joaco, Acerola				
Taijutsu Médico	Habilidades Secundarias	3	3	0	Disponible					
Experimentación Genética	Habilidades Secundarias	3	3	0	Disponible					
Experimentación Química	Habilidades Secundarias	3	3	0	Disponible					
Experimentación Inorgánica	Habilidades Secundarias	3	3	0	Disponible					
Rakanken	Habilidades Secundarias	3	1	0	Disponible					
Kyoumei Supiikaa	Habilidades Secundarias	3	1	0	Disponible					
Hi no Tera	Habilidades Secundarias	3	1	0	Disponible					
Rasengan	Habilidades Secundarias	3	3	0	Disponible					
Chidori	Habilidades Secundarias	3	3	0	Disponible					
Implante de Conductos	Habilidades Secundarias	2	1	0	Disponible					
Fuuinjutsu	Habilidades Secundarias	2	0	0	Sin plazas					
Edo Tensei	Habilidades Secundarias	1	1	0	Disponible					
Juinjutsu	Habilidades Secundarias	1	1	0	Disponible					
Hachimon Tonkou: Seimon	Habilidades Secundarias	1	2	0	Disponible					
Hachimon Tonkou: Shoumon	Habilidades Secundarias	1	2	0	Disponible					
Hachimon Tonkou: Tomon	Habilidades Secundarias	1	2	0	Disponible					
Hachimon Tonkou: Keimon	Habilidades Secundarias	1	2	0	Disponible					
Hachimon Tonkou: Kyoumon	Habilidades Secundarias	1	2	0	Disponible					
Hachimon Tonkou no Jin	Habilidades Secundarias	1	2	0	Disponible					
Fuerza amplificada	Habilidades Secundarias	1	3	0	Disponible					
Kongou fuusa	Habilidades Secundarias	1	1	0	Disponible					
Kagura shingan	Habilidades Secundarias	1	1	0	Disponible					
Kohaku no Jouhei	Armas Legendarias	3	1	0	Disponible					
Samehada	Armas Legendarias	3	1	0	Disponible			Chakra	3	
Shibuki	Armas Legendarias	2	1	0	Disponible					
Fujaku Hishou Shouken	Armas Legendarias	2	1	0	Disponible					
Bashousen	Armas Legendarias	2	1	0	Disponible					
Gunbai	Armas Legendarias	2	1	0	Disponible					
Kusanagi no Tsurugi	Armas Legendarias	2	1	0	Disponible					
Raijin no Ken	Armas Legendarias	2	1	0	Disponible					
Chokuto	Armas Legendarias	2	1	0	Disponible					
Chakura no Yoroi	Armas Legendarias	2	1	0	Disponible					
Shichiseiken	Armas Legendarias	2	1	0	Disponible					
Benihisago	Armas Legendarias	2	1	0	Disponible					
Koukinjou	Armas Legendarias	2	1	0	Disponible					
Gokuraku no Hakou	Armas Legendarias	2	1	0	Disponible					
Nuibari	Armas Legendarias	2	1	0	Disponible					
Kabutowari	Armas Legendarias	2	1	0	Disponible					
Kubikiribōchō	Armas Legendarias	2	1	0	Disponible					
Kiba	Armas Legendarias	2	1	0	Disponible					
Hiramekarei	Armas Legendarias	2	1	0	Disponible					
Naitosoudo	Armas Legendarias	2	1	0	Disponible					
Eiyu no Mizu	Armas Legendarias	2	1	0	Disponible					
Guante Petrificador	Armas Legendarias	1	1	0	Disponible					
Kokutou	Armas Legendarias	1	1	0	Disponible					
Hakko Chakura Tō	Armas Legendarias	1	1	0	Disponible					
Espada de fuego	Armas Legendarias	1	1	0	Disponible					
Gariantou	Armas Legendarias	1	1	0	Disponible					
Mugen Kougai	Armas Legendarias	1	1	0	Disponible					
Touton Jutsu	Técnicas Random	0	1	0	Disponible					
Control sobre vendas	Técnicas Random	0	1	0	Disponible					
Chakura no Hari	Técnicas Random	0	1	0	Disponible					
Transmisión de Chakra	Técnicas Random	0	2	0	Disponible					
Konbi Henge	Técnicas Random	0	1	0	Disponible					
Meisaigakure no Jutsu	Técnicas Random	0	1	0	Disponible					
Kanashibari Jutsu	Técnicas Random	0	1	0	Disponible					
Supresión de chakra	Técnicas Random	0	1	0	Disponible					
Hari Jizou	Técnicas Random	0	1	0	Disponible					
Hari Jigoku	Técnicas Random	0	1	0	Disponible					
Kebari Senbon	Técnicas Random	0	1	0	Disponible					
Ocultación en superficie	Técnicas Random	0	1	0	Disponible					
Shuriken Kage Bunshin no Jutsu	Técnicas Random	0	1	0	Disponible					
Proyección	Técnicas Random	0	1	0	Disponible					
Ranjishigami no Jutsu	Técnicas Random	0	1	0	Disponible					
Koumori Seichuu	Técnicas Random	0	1	0	Disponible					
Esfera de luz	Técnicas Random	0	1	0	Disponible					
Kodama no Jutsu	Técnicas Random	0	1	0	Disponible					
Kawara Shuriken	Técnicas Random	0	1	0	Disponible					
Trampa de cabello	Técnicas Random	0	1	0	Disponible					
Esferas de chicle	Técnicas Random	0	1	0	Disponible					
Alteración corporal	Técnicas Random	0	1	0	Disponible					
Sumerudama	Técnicas Random	0	1	0	Disponible					
Utsusemi no Jutsu	Técnicas Random	0	1	0	Disponible					
Cuerdas de sombra	Técnicas Random	0	1	0	Disponible					
Shogyou Mujou	Técnicas Random	0	1	0	Disponible					
Nakijutsu	Técnicas Random	0	1	0	Disponible					
Onda de sonido de cabello	Técnicas Random	0	1	0	Disponible					
Control de alambres	Técnicas Random	0	1	0	Disponible					
Atadura con hilos	Técnicas Random	0	1	0	Disponible					
Kago no Me	Técnicas Random	0	1	0	Disponible					
Ayametori	Técnicas Random	0	1	0	Disponible					
Bandera de viento	Técnicas Random	0	1	0	Disponible					
Orbes de luz	Técnicas Random	0	1	0	Disponible					
Chakra líquido	Técnicas Random	0	1	0	Disponible					
Gyoraishin	Técnicas Random	0	1	0	Disponible					
Comunicación mediante Pergamino	Técnicas Random	0	1	0	Disponible					
Discos de hielo	Técnicas Random	0	1	0	Disponible					
Tecnica de Entrada Oculta	Técnicas Random	0	1	0	Disponible					
Maldición de mandala	Técnicas Random	0	1	0	Disponible					
Reika no jutsu	Técnicas Random	0	1	0	Disponible					
Shippū Jinrai	Técnicas Random	0	1	0	Disponible					
Burbujas de olor	Técnicas Random	0	1	0	Disponible					
Transmisión de ondas	Técnicas Random	0	1	0	Disponible					
Ninpou: Nekokaburi	Técnicas Random	0	1	0	Disponible					
Técnica de creación de garras	Técnicas Random	0	1	0	Disponible					
Mugen Houyou	Técnicas Random	0	1	0	Disponible					
Tajuu Mugen Houyou	Técnicas Random	0	1	0	Disponible					
Ocultación en sombra	Técnicas Random	0	1	0	Disponible					
Kuchi no In no Jutsu	Técnicas Random	0	1	0	Disponible					
Repulsión	Técnicas Random	0	1	0	Disponible					
Reflexión de gotas	Técnicas Random	0	1	0	Disponible					
Kaihi no Jutsu	Técnicas Random	0	1	0	Disponible					
Zoufuku Kuchiyose no Jutsu	Técnicas Random	0	1	0	Disponible					
Kuchiyose Goumon Heya	Técnicas Random	0	1	0	Disponible					
Saiko Denshin	Técnicas Random	0	1	0	Disponible					
Aian Meiden	Técnicas Random	0	1	0	Disponible					
Insecto espía	Técnicas Random	0	1	0	Disponible					
Shoushagan no Jutsu	Técnicas Random	0	1	0	Disponible					
Onda de sonido	Técnicas Random	0	1	0	Disponible					
Chakura no Giso	Técnicas Random	0	1	0	Disponible					
Moubaku Sajin: Noizua	Técnicas Random	0	1	0	Disponible					
Hijutsu Ishibari	Técnicas Random	0	1	0	Disponible					
Lectura de mente ocular	Técnicas Random	0	1	0	Disponible					
Maldición de hilos de chakra	Técnicas Random	0	1	0	Disponible					
Borrador de memoria	Técnicas Random	0	1	0	Disponible					
Bunretsu no Jutsu	Técnicas Random	0	1	0	Disponible					
Bakuretsuchuu	Técnicas Random	0	1	0	Disponible					
Bunshin Daibakuha	Técnicas Random	0	1	0	Disponible					
Sennou Sousa no Jutsu	Técnicas Random	0	1	0	Disponible					
Rotura de barrera	Técnicas Random	0	1	0	Disponible					
Kokoro Kasoku no Jutsu	Técnicas Random	0	1	0	Disponible					
Fuerza aumentada	Técnicas Random	0	1	0	Disponible					
Kazegumo no Jutsu	Técnicas Random	0	1	0	Disponible					
Alteración terrenal	Técnicas Random	0	1	0	Disponible					
Meikyuu Kekkai	Técnicas Random	0	1	0	Disponible					
Gojou Kibaku Fuda	Técnicas Random	0	1	0	Disponible					
Gran esfera de Chakra	Técnicas Random	0	1	0	Disponible					
Kekkaimon Gofuujutsu: Hachimon Heijou	Técnicas Random	0	1	0	Disponible					
Gentoushin no Jutsu	Técnicas Random	0	1	0	Disponible					
Tensou no Jutsu	Técnicas Random	0	1	0	Disponible					
Kage Kagami Shinten no Hou	Técnicas Random	0	1	0	Disponible					
Kugutsu no Noroi	Técnicas Random	1	1	0	Disponible					
Rasenringu	Técnicas Random	1	1	0	Disponible					
Dai Rasenringu	Técnicas Random	1	1	0	Disponible					
Saisei Nouryoku	Técnicas Random	1	1	0	Disponible					
Shishou Tenketsu	Técnicas Random	1	1	0	Disponible					
Tsuchigumo-Ryuu: Kinseijutsu Kaihoo: Tenchi Kaibyaku	Técnicas Random	1	1	0	Disponible					
Fushi Tensei	Técnicas Random	1	1	0	Disponible					
Doble Kekkei Genkai	Cualidades Únicas	0	1	1	Ocupado	Joaco				
Absorción de chakra	Cualidades Únicas	0	1	0	Disponible					
Genética Perfecta	Cualidades Únicas	0	1	0	Disponible					
Sellos en conjunto	Cualidades Únicas	0	1	0	Disponible					
Sellos Unimanuales	Cualidades Únicas	0	1	0	Disponible					
Capacidad de vuelo	Cualidades Únicas	0	1	0	Disponible					
Veneno de salamandra negra	Cualidades Únicas	0	1	0	Disponible					
Aura Demoníaca	Cualidades Únicas	0	1	0	Disponible					
Ojo AntiGenjutsu	Cualidades Únicas	0	1	0	Disponible					
Bijuu sin cola	Cualidades Únicas	0	1	1	Ocupado	wadysh		Chakra	4	
Henge no Jutsu Permanente	Cualidades Únicas	0	1	0	Disponible					
Prodigio	Cualidades Únicas	0	2	1	Disponible	Gamberrodan				Presteza, Carismático
Golden Point en Armas	Golden Points	1	1	0	Disponible					
Golden Point en Velocidad	Golden Points	1	1	0	Disponible					
Golden Point en Inteligencia	Golden Points	1	1	0	Disponible					
Golden Point en Chakra	Golden Points	1	1	0	Disponible					
Golden Point en Fuerza	Golden Points	1	1	0	Disponible					
Golden Point en Resistencia	Golden Points	1	1	0	Disponible					
Golden Point en Percepción	Golden Points	1	1	0	Disponible					
Firma Gama	Pactos de Invocación	3	3	0	Disponible					
Firma Hebi	Pactos de Invocación	3	3	0	Disponible					
Firma Katsuyu	Pactos de Invocación	3	3	0	Disponible					
Puertas Rashoumon	Pactos de Invocación	2	1	0	Disponible					
Saru	Pactos de Invocación	2	1	0	Disponible					
Moguranmaru	Pactos de Invocación	2	1	0	Disponible					
Garuda	Pactos de Invocación	2	1	0	Disponible					
Ave pico-taladro	Pactos de Invocación	2	1	0	Disponible					
Isla Shimagame	Pactos de Invocación	2	1	0	Disponible					
Pacto Ninneko	Pactos de Invocación	2	1	0	Disponible					
Camaleón Gigante	Pactos de Invocación	2	1	0	Disponible					
Can Gigante	Pactos de Invocación	2	1	0	Disponible					
Fukuemon	Pactos de Invocación	2	1	0	Disponible					
Karasu	Pactos de Invocación	2	1	0	Disponible					
Kyūkyoku no Kuchiyosejū	Pactos de Invocación	2	1	0	Disponible					
Ave Ninja	Pactos de Invocación	2	1	0	Disponible					
Dorō Gōremu	Pactos de Invocación	2	1	0	Disponible					
Umibouzu	Pactos de Invocación	2	1	0	Disponible					
Ninken	Pactos de Invocación	2	1	0	Disponible					
Ôhamaguri	Pactos de Invocación	2	1	0	Disponible					
Canguro	Pactos de Invocación	2	1	0	Disponible					
Kondoru	Pactos de Invocación	2	1	0	Disponible					
Baira Ô	Pactos de Invocación	2	1	0	Disponible					
Ibuse	Pactos de Invocación	2	1	0	Disponible					
Marlin	Pactos de Invocación	2	1	0	Disponible					
Shiromari	Pactos de Invocación	2	1	0	Disponible					
Baku	Pactos de Invocación	2	1	0	Disponible					
Same	Pactos de Invocación	2	1	0	Disponible					
Pacto con Pirañas	Pactos de Invocación	2	1	0	Disponible					
Buey	Pactos de Invocación	2	1	0	Disponible					
Rinoceronte	Pactos de Invocación	2	1	0	Disponible					
Panda	Pactos de Invocación	2	1	0	Disponible					
Ciempiés	Pactos de Invocación	2	1	0	Disponible					
Crustáceo	Pactos de Invocación	2	1	0	Disponible					
Ryuurimaru	Pactos de Invocación	2	1	0	Disponible					
Rouen	Pactos de Invocación	2	1	0	Disponible					
Ninken Guardián	Pactos de Invocación	2	1	0	Disponible					
Kyodaigumo	Pactos de Invocación	2	1	0	Disponible					
Abeja Reina	Pactos de Invocación	2	1	0	Disponible					
Soldados	Pactos de Invocación	2	1	0	Disponible					
`; 

async function main() {
    console.log("🚀 [PRISMA 7] Iniciando inyección masiva de Plazas...");
    
    const filas = datosExcel.trim().split('\n');
    let inyectadas = 0;

    const pendingInheritances: Array<{ parentName: string; childNames: string[] }> = [];
    const pendingTraitInheritances: Array<{ plazaName: string; traitNames: string[] }> = [];

    for (const fila of filas) {
        const columnas = fila.trim().split('\t');
        const nombre = columnas[0]?.trim();
        
        // Saltar cabeceras o filas vacías
        if (!nombre || nombre.includes("Nombre de Guía")) continue;

        const categoriaRaw = columnas[1]?.trim() || "Otros";
        const categoria = categoriaRaw === 'Habilidades Secundarias'
            ? 'Complementarios'
            : categoriaRaw === 'Habilidades Especiales'
                ? 'Especiales'
                : categoriaRaw;

        const costoCupos = parseInt(columnas[2] || "0") || 0;
        const maxHoldersRaw = parseInt(columnas[3] || "0") || 0;
        // Treat 0 as unlimited (9999) to match old system behavior
        const maxHolders = maxHoldersRaw === 0 ? 9999 : maxHoldersRaw;
        const bonusStatName = columnas[8]?.trim() || null;
        const bonusStatValue = parseInt(columnas[9] || "0") || 0;

        // Parse inheritance fields (columns 7 and 10)
        const extrasRaw = columnas[7]?.trim() || null;
        const rasgoGratisRaw = columnas[10]?.trim() || null;

        const plazaPayload = {
            category: categoria,
            costCupos: costoCupos,
            maxHolders,
            bonusStatValue,
            ...(bonusStatName ? { bonusStatName } : { bonusStatName: null })
        };

        await prisma.plaza.upsert({
            where: { name: nombre },
            update: plazaPayload,
            create: { name: nombre, ...plazaPayload }
        });
        
        console.log(`✅ Guía sincronizada: ${nombre} (${categoria}) - Costo Cupos: ${costoCupos} - Plazas: ${maxHolders}`);
        inyectadas++;

        // Collect inheritance relationships for second pass
        if (extrasRaw) {
            const childNames = extrasRaw.split(',').map(n => n.trim()).filter(n => n.length > 0);
            if (childNames.length > 0) {
                pendingInheritances.push({ parentName: nombre, childNames });
            }
        }

        if (rasgoGratisRaw) {
            const traitNames = rasgoGratisRaw.split(',').map(n => n.trim()).filter(n => n.length > 0);
            if (traitNames.length > 0) {
                pendingTraitInheritances.push({ plazaName: nombre, traitNames });
            }
        }
    }

    // Second pass: Create PlazaPlazaInheritance records
    console.log("\n🔗 Creating Plaza-to-Plaza inheritance relationships...");
    for (const inheritance of pendingInheritances) {
        const parentPlaza = await prisma.plaza.findUnique({
            where: { name: inheritance.parentName },
            select: { id: true }
        });

        if (!parentPlaza) {
            console.warn(`⚠️  Parent plaza '${inheritance.parentName}' not found`);
            continue;
        }

        for (const childName of inheritance.childNames) {
            const childPlaza = await prisma.plaza.findUnique({
                where: { name: childName },
                select: { id: true }
            });

            if (!childPlaza) {
                console.warn(`⚠️  Child plaza '${childName}' not found`);
                continue;
            }

            await prisma.plazaPlazaInheritance.upsert({
                where: {
                    parentId_childId: {
                        parentId: parentPlaza.id,
                        childId: childPlaza.id
                    }
                },
                update: {},
                create: {
                    parentId: parentPlaza.id,
                    childId: childPlaza.id
                }
            });

            console.log(`  ✓ ${inheritance.parentName} → ${childName}`);
        }
    }

    // Third pass: Create PlazaTraitInheritance records
    console.log("\n🧬 Creating Plaza-to-Trait inheritance relationships...");
    for (const inheritance of pendingTraitInheritances) {
        const plaza = await prisma.plaza.findUnique({
            where: { name: inheritance.plazaName },
            select: { id: true }
        });

        if (!plaza) {
            console.warn(`⚠️  Plaza '${inheritance.plazaName}' not found`);
            continue;
        }

        for (const traitName of inheritance.traitNames) {
            const trait = await prisma.trait.findUnique({
                where: { name: traitName },
                select: { id: true }
            });

            if (!trait) {
                console.warn(`⚠️  Trait '${traitName}' not found`);
                continue;
            }

            await prisma.plazaTraitInheritance.upsert({
                where: {
                    plazaId_traitId: {
                        plazaId: plaza.id,
                        traitId: trait.id
                    }
                },
                update: {},
                create: {
                    plazaId: plaza.id,
                    traitId: trait.id
                }
            });

            console.log(`  ✓ ${inheritance.plazaName} → trait ${traitName}`);
        }
    }

    console.log(`\n🎉 SEED COMPLETADO: ${inyectadas} Guías/Plazas registradas.`);
}

main()
    .catch((e) => { console.error("❌ ERROR EN SEED:", e); process.exit(1); })
    .finally(async () => { 
        await prisma.$disconnect();
        await pool.end();
    });