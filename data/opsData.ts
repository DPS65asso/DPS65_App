
export const OPS_DATA = {
    hospitals: [
        { name: "CH Bigorre (Tarbes - La Gespe)", pos: [43.2333, 0.0833] as [number, number], tel: "05 62 51 51 51", type: "CH" },
        { name: "CH Lourdes", pos: [43.0940, -0.0460] as [number, number], tel: "05 62 42 42 42", type: "CH" },
        { name: "Polyclinique de l'Ormeau (Centre)", pos: [43.2290, 0.0750] as [number, number], tel: "05 62 56 56 56", type: "CLINIC" },
        { name: "Polyclinique de l'Ormeau (Pyrénées)", pos: [43.2200, 0.0700] as [number, number], tel: "05 62 56 56 56", type: "CLINIC" },
        { name: "CH Bagnères-de-Bigorre", pos: [43.0667, 0.1500] as [number, number], tel: "05 62 91 40 00", type: "CH" },
        { name: "CH Lannemezan", pos: [43.1250, 0.3833] as [number, number], tel: "05 62 99 55 55", type: "CH" },
        { name: "Hôpital de Vic-en-Bigorre", pos: [43.3860, 0.0530] as [number, number], tel: "05 62 31 80 00", type: "CH" },
        { name: "Hôpital d'Argelès-Gazost", pos: [43.0050, -0.0960] as [number, number], tel: "05 62 97 10 10", type: "CH" },
        { name: "Hôpital Astugue (Gériatrie)", pos: [43.0900, 0.0700] as [number, number], tel: "05 62 38 60 00", type: "CH" }
    ],
    medicalHomes: [
        { name: "MMG Tarbes (La Gespe)", pos: [43.2340, 0.0840] as [number, number], info: "Via Centre 15" },
        { name: "MMG Lourdes", pos: [43.0950, -0.0470] as [number, number], info: "Via Centre 15" },
        { name: "MMG Bagnères", pos: [43.0670, 0.1510] as [number, number], info: "Via Centre 15" },
        { name: "MMG Lannemezan", pos: [43.1260, 0.3840] as [number, number], info: "Via Centre 15" },
        { name: "MMG Argelès-Gazost", pos: [43.0060, -0.0950] as [number, number], info: "Via Centre 15" },
        { name: "MMG Vic-en-Bigorre", pos: [43.3870, 0.0540] as [number, number], info: "Via Centre 15" },
        { name: "MMG Saint-Lary (Hiver)", pos: [42.8160, 0.3210] as [number, number], info: "Saison" },
        { name: "MMG Cauterets (Hiver)", pos: [42.8890, -0.1120] as [number, number], info: "Saison" },
    ],
    fireStations: [
        // AGGLO & CENTRES PRINCIPAUX
        { name: "CSP Tarbes", pos: [43.2255, 0.0656] as [number, number], tel: "18" },
        { name: "CSP Lourdes", pos: [43.1042, -0.0383] as [number, number], tel: "18" },
        { name: "CSP Bagnères-de-Bigorre", pos: [43.0678, 0.1541] as [number, number], tel: "18" },
        { name: "CS Lannemezan", pos: [43.1278, 0.3856] as [number, number], tel: "18" },
        { name: "CS Argelès-Gazost", pos: [43.0062, -0.0967] as [number, number], tel: "18" },
        { name: "CS Vic-en-Bigorre", pos: [43.3853, 0.0531] as [number, number], tel: "18" },
        
        // NORD & PLAINE
        { name: "CS Maubourguet", pos: [43.4680, 0.0340] as [number, number], tel: "18" },
        { name: "CS Rabastens-de-Bigorre", pos: [43.3880, 0.1500] as [number, number], tel: "18" },
        { name: "CS Andrest", pos: [43.3150, 0.0600] as [number, number], tel: "18" },
        { name: "CS Ossun", pos: [43.1830, -0.0300] as [number, number], tel: "18" },
        { name: "CS Ibos", pos: [43.2300, 0.0050] as [number, number], tel: "18" },
        { name: "CS Bordères-sur-l'Echez", pos: [43.2600, 0.0500] as [number, number], tel: "18" },
        { name: "CS Trie-sur-Baïse", pos: [43.3200, 0.3700] as [number, number], tel: "18" },
        { name: "CS Castelnau-Magnoac", pos: [43.2950, 0.5080] as [number, number], tel: "18" },
        { name: "CS Galan", pos: [43.2200, 0.4000] as [number, number], tel: "18" },

        // SUD & MONTAGNE
        { name: "CS Pierrefitte-Nestalas", pos: [42.9600, -0.0700] as [number, number], tel: "18" },
        { name: "CS Cauterets", pos: [42.8880, -0.1130] as [number, number], tel: "18" },
        { name: "CS Luz-Saint-Sauveur", pos: [42.8700, -0.0050] as [number, number], tel: "18" },
        { name: "CS Barèges", pos: [42.8900, 0.0600] as [number, number], tel: "18" },
        { name: "CS Campan", pos: [43.0160, 0.1760] as [number, number], tel: "18" },
        { name: "CS Arreau", pos: [42.9060, 0.3580] as [number, number], tel: "18" },
        { name: "CS Saint-Lary-Soulan", pos: [42.8150, 0.3200] as [number, number], tel: "18" },
        { name: "CS Bordères-Louron", pos: [42.8700, 0.3900] as [number, number], tel: "18" },
        
        // EST & PLATEAU
        { name: "CS Capvern", pos: [43.1000, 0.3100] as [number, number], tel: "18" },
        { name: "CS Tournay", pos: [43.1800, 0.2400] as [number, number], tel: "18" },
        { name: "CS La Barthe-de-Neste", pos: [43.0800, 0.3800] as [number, number], tel: "18" },
        { name: "CS Mauléon-Barousse", pos: [42.9600, 0.5600] as [number, number], tel: "18" },
    ],
    dz: [
        // HÔPITAUX
        { name: "DZ CH Bigorre", pos: [43.2345, 0.0845] as [number, number], type: "Hôpital" },
        { name: "DZ CH Lourdes", pos: [43.0955, -0.0465] as [number, number], type: "Hôpital" },
        { name: "DZ CH Lannemezan", pos: [43.1260, 0.3840] as [number, number], type: "Hôpital" },
        // BASES SECOURS
        { name: "DZ PGHM Pierrefitte", pos: [42.9610, -0.0710] as [number, number], type: "Secours" },
        { name: "DZ CRS Gavarnie", pos: [42.7350, -0.0090] as [number, number], type: "Secours" },
        { name: "DZ CRS Saint-Lary", pos: [42.8180, 0.3220] as [number, number], type: "Secours" },
        // MONTAGNE STRATÉGIQUE
        { name: "DZ Plateau Cauterets", pos: [42.8500, -0.1100] as [number, number], type: "Montagne" },
        { name: "DZ La Mongie (Parking)", pos: [42.9100, 0.1800] as [number, number], type: "Station" },
        { name: "DZ Piau Engaly", pos: [42.7800, 0.1600] as [number, number], type: "Station" },
        { name: "DZ Super Barèges", pos: [42.9000, 0.0800] as [number, number], type: "Station" },
        { name: "DZ Hautacam", pos: [42.9700, -0.0300] as [number, number], type: "Station" },
        { name: "DZ Payolle", pos: [42.9350, 0.2850] as [number, number], type: "Secours" }
    ],
    dae: [
        // TARBES
        { name: "DAE Mairie Tarbes", pos: [43.2320, 0.0780] as [number, number], loc: "Façade" },
        { name: "DAE Halle Marcadieu", pos: [43.2300, 0.0850] as [number, number], loc: "Intérieur Sud" },
        { name: "DAE Halle Brauhauban", pos: [43.2330, 0.0760] as [number, number], loc: "Entrée Ouest" },
        { name: "DAE Gare SNCF Tarbes", pos: [43.2400, 0.0700] as [number, number], loc: "Hall Principal" },
        { name: "DAE Palais des Sports", pos: [43.2200, 0.0600] as [number, number], loc: "Accueil" },
        
        // LOURDES
        { name: "DAE Gare Lourdes", pos: [43.1000, -0.0400] as [number, number], loc: "Hall" },
        { name: "DAE Sanctuaires (Grotte)", pos: [43.0970, -0.0550] as [number, number], loc: "Accueil Médical" },
        { name: "DAE Mairie Lourdes", pos: [43.0930, -0.0450] as [number, number], loc: "Entrée" },
        { name: "DAE Halles Lourdes", pos: [43.0950, -0.0430] as [number, number], loc: "Mur Est" },

        // BAGNÈRES & VALLÉE
        { name: "DAE Mairie Bagnères", pos: [43.0650, 0.1520] as [number, number], loc: "Entrée" },
        { name: "DAE Halles Bagnères", pos: [43.0640, 0.1500] as [number, number], loc: "Pilier Central" },
        { name: "DAE Lac de Payolle", pos: [42.9300, 0.2800] as [number, number], loc: "Poste Secours" },
        { name: "DAE Mairie Campan", pos: [43.0170, 0.1770] as [number, number], loc: "Façade" },

        // LANNEMEZAN & EST
        { name: "DAE Mairie Lannemezan", pos: [43.1260, 0.3850] as [number, number], loc: "Entrée" },
        { name: "DAE Gare Lannemezan", pos: [43.1200, 0.3900] as [number, number], loc: "Quai 1" },
        { name: "DAE Mairie Capvern", pos: [43.1020, 0.3150] as [number, number], loc: "Façade" },

        // ARGELES & VALLÉES
        { name: "DAE Mairie Argelès", pos: [43.0060, -0.0960] as [number, number], loc: "Entrée" },
        { name: "DAE Parc Animalier", pos: [43.0000, -0.0900] as [number, number], loc: "Guichet" },
        { name: "DAE Mairie Cauterets", pos: [42.8880, -0.1130] as [number, number], loc: "Façade" },
        { name: "DAE Pont d'Espagne", pos: [42.8500, -0.1400] as [number, number], loc: "Accueil Puntas" },
        { name: "DAE Mairie Luz", pos: [42.8720, -0.0030] as [number, number], loc: "Façade" },
        { name: "DAE Gavarnie Village", pos: [42.7320, -0.0100] as [number, number], loc: "Office Tourisme" },

        // NORD
        { name: "DAE Mairie Vic", pos: [43.3850, 0.0520] as [number, number], loc: "Façade" },
        { name: "DAE Mairie Maubourguet", pos: [43.4690, 0.0350] as [number, number], loc: "Entrée" },
        { name: "DAE Mairie Rabastens", pos: [43.3880, 0.1510] as [number, number], loc: "Façade" }
    ]
};
