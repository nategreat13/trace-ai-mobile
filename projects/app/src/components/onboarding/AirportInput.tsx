import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from "react-native";
import { colors } from "../../theme/colors";

interface Airport {
  code: string;
  name: string;
  city: string;
  state: string;
}

export const AIRPORTS: Airport[] = [
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", state: "GA" },
  { code: "AUS", name: "Austin-Bergstrom International", city: "Austin", state: "TX" },
  { code: "BDL", name: "Bradley International", city: "Hartford", state: "CT" },
  { code: "BNA", name: "Nashville International", city: "Nashville", state: "TN" },
  { code: "BOS", name: "Logan International", city: "Boston", state: "MA" },
  { code: "BUF", name: "Buffalo Niagara International", city: "Buffalo", state: "NY" },
  { code: "BWI", name: "Baltimore/Washington International", city: "Baltimore", state: "MD" },
  { code: "CLT", name: "Charlotte Douglas International", city: "Charlotte", state: "NC" },
  { code: "CMH", name: "John Glenn Columbus International", city: "Columbus", state: "OH" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX" },
  { code: "DEN", name: "Denver International", city: "Denver", state: "CO" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", state: "TX" },
  { code: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", state: "MI" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", state: "NJ" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", state: "FL" },
  { code: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI" },
  { code: "HOU", name: "William P. Hobby Airport", city: "Houston", state: "TX" },
  { code: "IAD", name: "Washington Dulles International", city: "Washington", state: "DC" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX" },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN" },
  { code: "JFK", name: "John F. Kennedy International", city: "New York", state: "NY" },
  { code: "LAS", name: "Harry Reid International", city: "Las Vegas", state: "NV" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", state: "CA" },
  { code: "LGA", name: "LaGuardia Airport", city: "New York", state: "NY" },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO" },
  { code: "MCO", name: "Orlando International", city: "Orlando", state: "FL" },
  { code: "MDW", name: "Chicago Midway International", city: "Chicago", state: "IL" },
  { code: "MEM", name: "Memphis International", city: "Memphis", state: "TN" },
  { code: "MIA", name: "Miami International", city: "Miami", state: "FL" },
  { code: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", state: "WI" },
  { code: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", state: "MN" },
  { code: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", state: "LA" },
  { code: "OAK", name: "Oakland International", city: "Oakland", state: "CA" },
  { code: "OGG", name: "Kahului Airport", city: "Maui", state: "HI" },
  { code: "OMA", name: "Eppley Airfield", city: "Omaha", state: "NE" },
  { code: "ONT", name: "Ontario International", city: "Ontario", state: "CA" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", state: "IL" },
  { code: "ORF", name: "Norfolk International", city: "Norfolk", state: "VA" },
  { code: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL" },
  { code: "PDX", name: "Portland International", city: "Portland", state: "OR" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", state: "PA" },
  { code: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", state: "AZ" },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA" },
  { code: "PVD", name: "T.F. Green International", city: "Providence", state: "RI" },
  { code: "RDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC" },
  { code: "RIC", name: "Richmond International", city: "Richmond", state: "VA" },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", state: "NV" },
  { code: "RSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL" },
  { code: "SAN", name: "San Diego International", city: "San Diego", state: "CA" },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX" },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", state: "WA" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", state: "CA" },
  { code: "SJC", name: "Norman Y. Mineta San Jose International", city: "San Jose", state: "CA" },
  { code: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", state: "PR" },
  { code: "SLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT" },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA" },
  { code: "SNA", name: "John Wayne Airport", city: "Orange County", state: "CA" },
  { code: "STL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO" },
  { code: "TPA", name: "Tampa International", city: "Tampa", state: "FL" },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK" },
  { code: "TUS", name: "Tucson International", city: "Tucson", state: "AZ" },
  // More US domestic
  { code: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", state: "NM" },
  { code: "ALB", name: "Albany International Airport", city: "Albany", state: "NY" },
  { code: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", state: "AK" },
  { code: "ASE", name: "Aspen-Pitkin County Airport", city: "Aspen", state: "CO" },
  { code: "BHM", name: "Birmingham-Shuttlesworth International", city: "Birmingham", state: "AL" },
  { code: "BIL", name: "Billings Logan International Airport", city: "Billings", state: "MT" },
  { code: "BOI", name: "Boise Airport", city: "Boise", state: "ID" },
  { code: "BTR", name: "Baton Rouge Metropolitan Airport", city: "Baton Rouge", state: "LA" },
  { code: "BTV", name: "Burlington International Airport", city: "Burlington", state: "VT" },
  { code: "BZN", name: "Bozeman Yellowstone International", city: "Bozeman", state: "MT" },
  { code: "CAE", name: "Columbia Metropolitan Airport", city: "Columbia", state: "SC" },
  { code: "CHS", name: "Charleston International Airport", city: "Charleston", state: "SC" },
  { code: "CID", name: "The Eastern Iowa Airport", city: "Cedar Rapids", state: "IA" },
  { code: "CLE", name: "Cleveland Hopkins International Airport", city: "Cleveland", state: "OH" },
  { code: "COS", name: "Colorado Springs Airport", city: "Colorado Springs", state: "CO" },
  { code: "CVG", name: "Cincinnati/Northern Kentucky International", city: "Cincinnati", state: "OH" },
  { code: "DAY", name: "Dayton International Airport", city: "Dayton", state: "OH" },
  { code: "DSM", name: "Des Moines International Airport", city: "Des Moines", state: "IA" },
  { code: "ELP", name: "El Paso International Airport", city: "El Paso", state: "TX" },
  { code: "EUG", name: "Eugene Airport", city: "Eugene", state: "OR" },
  { code: "EYW", name: "Key West International Airport", city: "Key West", state: "FL" },
  { code: "FAI", name: "Fairbanks International Airport", city: "Fairbanks", state: "AK" },
  { code: "FAT", name: "Fresno Yosemite International Airport", city: "Fresno", state: "CA" },
  { code: "FSD", name: "Sioux Falls Regional Airport", city: "Sioux Falls", state: "SD" },
  { code: "GEG", name: "Spokane International Airport", city: "Spokane", state: "WA" },
  { code: "GPT", name: "Gulfport-Biloxi International Airport", city: "Gulfport", state: "MS" },
  { code: "GRR", name: "Gerald R. Ford International Airport", city: "Grand Rapids", state: "MI" },
  { code: "GSO", name: "Piedmont Triad International Airport", city: "Greensboro", state: "NC" },
  { code: "GSP", name: "Greenville-Spartanburg International", city: "Greenville", state: "SC" },
  { code: "HPN", name: "Westchester County Airport", city: "White Plains", state: "NY" },
  { code: "HSV", name: "Huntsville International Airport", city: "Huntsville", state: "AL" },
  { code: "ICT", name: "Wichita Dwight D. Eisenhower National", city: "Wichita", state: "KS" },
  { code: "JAC", name: "Jackson Hole Airport", city: "Jackson Hole", state: "WY" },
  { code: "JAN", name: "Jackson-Medgar Wiley Evers International", city: "Jackson", state: "MS" },
  { code: "JAX", name: "Jacksonville International Airport", city: "Jacksonville", state: "FL" },
  { code: "KOA", name: "Ellison Onizuka Kona International", city: "Kona", state: "HI" },
  { code: "LBB", name: "Lubbock Preston Smith International", city: "Lubbock", state: "TX" },
  { code: "LEX", name: "Blue Grass Airport", city: "Lexington", state: "KY" },
  { code: "LIH", name: "Lihue Airport", city: "Kauai", state: "HI" },
  { code: "LIT", name: "Bill and Hillary Clinton National Airport", city: "Little Rock", state: "AR" },
  { code: "MHT", name: "Manchester-Boston Regional Airport", city: "Manchester", state: "NH" },
  { code: "MLB", name: "Melbourne Orlando International Airport", city: "Melbourne", state: "FL" },
  { code: "MOB", name: "Mobile Regional Airport", city: "Mobile", state: "AL" },
  { code: "MRY", name: "Monterey Regional Airport", city: "Monterey", state: "CA" },
  { code: "MSN", name: "Dane County Regional Airport", city: "Madison", state: "WI" },
  { code: "MTJ", name: "Montrose Regional Airport", city: "Montrose", state: "CO" },
  { code: "MYR", name: "Myrtle Beach International Airport", city: "Myrtle Beach", state: "SC" },
  { code: "OKC", name: "Will Rogers World Airport", city: "Oklahoma City", state: "OK" },
  { code: "PNS", name: "Pensacola International Airport", city: "Pensacola", state: "FL" },
  { code: "PSP", name: "Palm Springs International Airport", city: "Palm Springs", state: "CA" },
  { code: "RAP", name: "Rapid City Regional Airport", city: "Rapid City", state: "SD" },
  { code: "ROC", name: "Greater Rochester International Airport", city: "Rochester", state: "NY" },
  { code: "SBA", name: "Santa Barbara Airport", city: "Santa Barbara", state: "CA" },
  { code: "SGF", name: "Springfield-Branson National Airport", city: "Springfield", state: "MO" },
  { code: "SHV", name: "Shreveport Regional Airport", city: "Shreveport", state: "LA" },
  { code: "SRQ", name: "Sarasota Bradenton International Airport", city: "Sarasota", state: "FL" },
  { code: "SYR", name: "Syracuse Hancock International Airport", city: "Syracuse", state: "NY" },
  { code: "TLH", name: "Tallahassee International Airport", city: "Tallahassee", state: "FL" },
  { code: "TVC", name: "Cherry Capital Airport", city: "Traverse City", state: "MI" },
  { code: "TYS", name: "McGhee Tyson Airport", city: "Knoxville", state: "TN" },
  { code: "VPS", name: "Destin-Fort Walton Beach Airport", city: "Fort Walton Beach", state: "FL" },
  { code: "XNA", name: "Northwest Arkansas National Airport", city: "Bentonville", state: "AR" },
  // Canada
  { code: "YYZ", name: "Toronto Pearson International", city: "Toronto", state: "Canada" },
  { code: "YVR", name: "Vancouver International", city: "Vancouver", state: "Canada" },
  { code: "YUL", name: "Montréal-Trudeau International", city: "Montreal", state: "Canada" },
  { code: "YYC", name: "Calgary International", city: "Calgary", state: "Canada" },
  { code: "YEG", name: "Edmonton International", city: "Edmonton", state: "Canada" },
  { code: "YOW", name: "Ottawa Macdonald-Cartier International", city: "Ottawa", state: "Canada" },
  // Mexico & Caribbean
  { code: "CUN", name: "Cancún International", city: "Cancún", state: "Mexico" },
  { code: "MEX", name: "Benito Juárez International", city: "Mexico City", state: "Mexico" },
  { code: "GDL", name: "Don Miguel Hidalgo y Costilla International", city: "Guadalajara", state: "Mexico" },
  { code: "SJD", name: "Los Cabos International", city: "Los Cabos", state: "Mexico" },
  { code: "PVR", name: "Licenciado Gustavo Díaz Ordaz International", city: "Puerto Vallarta", state: "Mexico" },
  { code: "MZT", name: "General Rafael Buelna International", city: "Mazatlán", state: "Mexico" },
  { code: "MBJ", name: "Sangster International", city: "Montego Bay", state: "Jamaica" },
  { code: "KIN", name: "Norman Manley International", city: "Kingston", state: "Jamaica" },
  { code: "NAS", name: "Lynden Pindling International", city: "Nassau", state: "Bahamas" },
  { code: "PUJ", name: "Punta Cana International", city: "Punta Cana", state: "Dominican Republic" },
  { code: "SDQ", name: "Las Américas International", city: "Santo Domingo", state: "Dominican Republic" },
  { code: "SJO", name: "Juan Santamaría International", city: "San José", state: "Costa Rica" },
  { code: "PTY", name: "Tocumen International", city: "Panama City", state: "Panama" },
  { code: "GUA", name: "La Aurora International", city: "Guatemala City", state: "Guatemala" },
  { code: "HAV", name: "José Martí International", city: "Havana", state: "Cuba" },
  { code: "SXM", name: "Princess Juliana International", city: "St. Maarten", state: "Caribbean" },
  { code: "ANU", name: "V.C. Bird International", city: "Antigua", state: "Caribbean" },
  { code: "BGI", name: "Grantley Adams International", city: "Bridgetown", state: "Barbados" },
  // Europe
  { code: "LHR", name: "Heathrow Airport", city: "London", state: "UK" },
  { code: "LGW", name: "Gatwick Airport", city: "London", state: "UK" },
  { code: "LCY", name: "London City Airport", city: "London", state: "UK" },
  { code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", state: "France" },
  { code: "ORY", name: "Orly Airport", city: "Paris", state: "France" },
  { code: "AMS", name: "Amsterdam Schiphol Airport", city: "Amsterdam", state: "Netherlands" },
  { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", state: "Germany" },
  { code: "MUC", name: "Munich Airport", city: "Munich", state: "Germany" },
  { code: "TXL", name: "Berlin Brandenburg Airport", city: "Berlin", state: "Germany" },
  { code: "BCN", name: "Barcelona-El Prat Airport", city: "Barcelona", state: "Spain" },
  { code: "MAD", name: "Adolfo Suárez Madrid-Barajas Airport", city: "Madrid", state: "Spain" },
  { code: "FCO", name: "Leonardo da Vinci–Fiumicino Airport", city: "Rome", state: "Italy" },
  { code: "MXP", name: "Milan Malpensa Airport", city: "Milan", state: "Italy" },
  { code: "VCE", name: "Venice Marco Polo Airport", city: "Venice", state: "Italy" },
  { code: "NAP", name: "Naples International Airport", city: "Naples", state: "Italy" },
  { code: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", state: "Portugal" },
  { code: "OPO", name: "Francisco Sá Carneiro Airport", city: "Porto", state: "Portugal" },
  { code: "DUB", name: "Dublin Airport", city: "Dublin", state: "Ireland" },
  { code: "ZRH", name: "Zurich Airport", city: "Zurich", state: "Switzerland" },
  { code: "GVA", name: "Geneva Airport", city: "Geneva", state: "Switzerland" },
  { code: "CPH", name: "Copenhagen Airport", city: "Copenhagen", state: "Denmark" },
  { code: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", state: "Sweden" },
  { code: "HEL", name: "Helsinki-Vantaa Airport", city: "Helsinki", state: "Finland" },
  { code: "OSL", name: "Oslo Gardermoen Airport", city: "Oslo", state: "Norway" },
  { code: "BRU", name: "Brussels Airport", city: "Brussels", state: "Belgium" },
  { code: "VIE", name: "Vienna International Airport", city: "Vienna", state: "Austria" },
  { code: "PRG", name: "Václav Havel Airport Prague", city: "Prague", state: "Czech Republic" },
  { code: "BUD", name: "Budapest Ferenc Liszt International", city: "Budapest", state: "Hungary" },
  { code: "WAW", name: "Warsaw Chopin Airport", city: "Warsaw", state: "Poland" },
  { code: "ATH", name: "Athens International Airport", city: "Athens", state: "Greece" },
  { code: "HER", name: "Heraklion International Airport", city: "Crete", state: "Greece" },
  { code: "SKG", name: "Thessaloniki Airport", city: "Thessaloniki", state: "Greece" },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", state: "Turkey" },
  { code: "SAW", name: "Sabiha Gökçen International", city: "Istanbul", state: "Turkey" },
  { code: "KEF", name: "Keflavík International Airport", city: "Reykjavik", state: "Iceland" },
  { code: "EDI", name: "Edinburgh Airport", city: "Edinburgh", state: "Scotland" },
  { code: "MAN", name: "Manchester Airport", city: "Manchester", state: "UK" },
  { code: "FCO", name: "Fiumicino Airport", city: "Rome", state: "Italy" },
  { code: "BVA", name: "Paris Beauvais Airport", city: "Paris", state: "France" },
  { code: "NTE", name: "Nantes Atlantique Airport", city: "Nantes", state: "France" },
  { code: "MRS", name: "Marseille Provence Airport", city: "Marseille", state: "France" },
  { code: "NCE", name: "Nice Côte d'Azur Airport", city: "Nice", state: "France" },
  // Asia & Pacific
  { code: "NRT", name: "Narita International Airport", city: "Tokyo", state: "Japan" },
  { code: "HND", name: "Haneda Airport", city: "Tokyo", state: "Japan" },
  { code: "KIX", name: "Kansai International Airport", city: "Osaka", state: "Japan" },
  { code: "ICN", name: "Incheon International Airport", city: "Seoul", state: "South Korea" },
  { code: "GMP", name: "Gimpo International Airport", city: "Seoul", state: "South Korea" },
  { code: "PVG", name: "Shanghai Pudong International", city: "Shanghai", state: "China" },
  { code: "SHA", name: "Shanghai Hongqiao International", city: "Shanghai", state: "China" },
  { code: "PEK", name: "Beijing Capital International", city: "Beijing", state: "China" },
  { code: "PKX", name: "Beijing Daxing International", city: "Beijing", state: "China" },
  { code: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", state: "Hong Kong" },
  { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", state: "Singapore" },
  { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", state: "Thailand" },
  { code: "DMK", name: "Don Mueang International Airport", city: "Bangkok", state: "Thailand" },
  { code: "HKT", name: "Phuket International Airport", city: "Phuket", state: "Thailand" },
  { code: "CNX", name: "Chiang Mai International Airport", city: "Chiang Mai", state: "Thailand" },
  { code: "KUL", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", state: "Malaysia" },
  { code: "CGK", name: "Soekarno-Hatta International", city: "Jakarta", state: "Indonesia" },
  { code: "DPS", name: "Ngurah Rai International Airport", city: "Bali", state: "Indonesia" },
  { code: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", state: "Australia" },
  { code: "MEL", name: "Melbourne Airport", city: "Melbourne", state: "Australia" },
  { code: "BNE", name: "Brisbane Airport", city: "Brisbane", state: "Australia" },
  { code: "PER", name: "Perth Airport", city: "Perth", state: "Australia" },
  { code: "AKL", name: "Auckland Airport", city: "Auckland", state: "New Zealand" },
  { code: "CHC", name: "Christchurch Airport", city: "Christchurch", state: "New Zealand" },
  { code: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", state: "Philippines" },
  { code: "CEB", name: "Mactan-Cebu International Airport", city: "Cebu", state: "Philippines" },
  { code: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", state: "Vietnam" },
  { code: "HAN", name: "Noi Bai International Airport", city: "Hanoi", state: "Vietnam" },
  { code: "DAD", name: "Da Nang International Airport", city: "Da Nang", state: "Vietnam" },
  { code: "REP", name: "Siem Reap International Airport", city: "Siem Reap", state: "Cambodia" },
  { code: "RGN", name: "Yangon International Airport", city: "Yangon", state: "Myanmar" },
  { code: "CMB", name: "Bandaranaike International Airport", city: "Colombo", state: "Sri Lanka" },
  { code: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", state: "India" },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International", city: "Mumbai", state: "India" },
  { code: "BLR", name: "Kempegowda International Airport", city: "Bangalore", state: "India" },
  // Middle East
  { code: "DXB", name: "Dubai International Airport", city: "Dubai", state: "UAE" },
  { code: "AUH", name: "Abu Dhabi International Airport", city: "Abu Dhabi", state: "UAE" },
  { code: "DOH", name: "Hamad International Airport", city: "Doha", state: "Qatar" },
  { code: "TLV", name: "Ben Gurion International Airport", city: "Tel Aviv", state: "Israel" },
  { code: "AMM", name: "Queen Alia International Airport", city: "Amman", state: "Jordan" },
  // Africa
  { code: "CAI", name: "Cairo International Airport", city: "Cairo", state: "Egypt" },
  { code: "HRG", name: "Hurghada International Airport", city: "Hurghada", state: "Egypt" },
  { code: "SSH", name: "Sharm El Sheikh International Airport", city: "Sharm El-Sheikh", state: "Egypt" },
  { code: "JNB", name: "O.R. Tambo International Airport", city: "Johannesburg", state: "South Africa" },
  { code: "CPT", name: "Cape Town International Airport", city: "Cape Town", state: "South Africa" },
  { code: "ADD", name: "Addis Ababa Bole International", city: "Addis Ababa", state: "Ethiopia" },
  { code: "NBO", name: "Jomo Kenyatta International Airport", city: "Nairobi", state: "Kenya" },
  { code: "MRU", name: "Sir Seewoosagur Ramgoolam International", city: "Mauritius", state: "Mauritius" },
  // Latin America
  { code: "GRU", name: "São Paulo-Guarulhos International", city: "São Paulo", state: "Brazil" },
  { code: "GIG", name: "Rio de Janeiro-Galeão International", city: "Rio de Janeiro", state: "Brazil" },
  { code: "EZE", name: "Ministro Pistarini International", city: "Buenos Aires", state: "Argentina" },
  { code: "BOG", name: "El Dorado International Airport", city: "Bogotá", state: "Colombia" },
  { code: "MDE", name: "José María Córdova International", city: "Medellín", state: "Colombia" },
  { code: "CTG", name: "Rafael Núñez International Airport", city: "Cartagena", state: "Colombia" },
  { code: "LIM", name: "Jorge Chávez International Airport", city: "Lima", state: "Peru" },
  { code: "CUZ", name: "Alejandro Velasco Astete International", city: "Cusco", state: "Peru" },
  { code: "SCL", name: "Arturo Merino Benítez International", city: "Santiago", state: "Chile" },
  { code: "UIO", name: "Mariscal Sucre International Airport", city: "Quito", state: "Ecuador" },
  { code: "GYE", name: "José Joaquín de Olmedo International", city: "Guayaquil", state: "Ecuador" },
  { code: "MVD", name: "Carrasco International Airport", city: "Montevideo", state: "Uruguay" },
  { code: "ASU", name: "Silvio Pettirossi International Airport", city: "Asunción", state: "Paraguay" },
];

interface AirportInputProps {
  value: string;
  onChange: (code: string) => void;
}

export default function AirportInput({ value, onChange }: AirportInputProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const selected = AIRPORTS.find((a) => a.code === value) ?? null;

  const results =
    query.trim().length > 0
      ? AIRPORTS.filter((a) => {
          const q = query.toLowerCase();
          return (
            a.code.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q) ||
            a.state.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q)
          );
        }).slice(0, 8)
      : [];

  // Note: dropdown visibility is deliberately decoupled from `focused`.
  // Earlier this read `focused && query.trim().length > 0 && results.length > 0`,
  // which broke a real workflow on small phones: keyboard covers the list,
  // user taps "Done" to dismiss it, onBlur fires → focused becomes false →
  // dropdown disappears even though there's a perfectly good query and
  // matching results. Now the dropdown stays visible whenever there's
  // a query with matches, so the user can pick from it after dismissing
  // the keyboard.
  const showDropdown = query.trim().length > 0 && results.length > 0;

  const handleSelect = (airport: Airport) => {
    onChange(airport.code);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <View>
      {/* Selected airport pill */}
      {selected && !focused && (
        <TouchableOpacity
          onPress={handleClear}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.brand.traceRed + "15",
            borderWidth: 1.5,
            borderColor: colors.brand.traceRed,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 22 }}>✈️</Text>
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.brand.traceRed }}>
                  {selected.code}
                </Text>
                <Text style={{ fontSize: 13, color: theme.foreground, fontWeight: "600" }}>
                  {selected.city}, {selected.state}
                </Text>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Change</Text>
        </TouchableOpacity>
      )}

      {/* Search input */}
      {(!selected || focused) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.muted,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: focused ? colors.brand.traceRed : theme.border,
            paddingHorizontal: 14,
            marginBottom: showDropdown ? 0 : 0,
          }}
        >
          <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search by city, state, or code…"
            placeholderTextColor={theme.mutedForeground}
            autoCorrect={false}
            autoCapitalize="characters"
            style={{
              flex: 1,
              fontSize: 16,
              color: theme.foreground,
              paddingVertical: 14,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 18, color: theme.mutedForeground }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <View
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 14,
            marginTop: 6,
            overflow: "hidden",
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
            {results.map((airport, index) => (
              <TouchableOpacity
                key={airport.code}
                onPress={() => handleSelect(airport)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand.traceRed, width: 36 }}>
                  {airport.code}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground, flex: 1 }} numberOfLines={1}>
                  {airport.city}, {airport.state}
                </Text>
                <Text style={{ fontSize: 11, color: theme.mutedForeground }} numberOfLines={1}>
                  {airport.name.split(" ").slice(0, 2).join(" ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hint when nothing typed yet and nothing selected */}
      {!selected && !focused && (
        <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 8, textAlign: "center" }}>
          Tap above and type to search
        </Text>
      )}
    </View>
  );
}
