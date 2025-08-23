import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, MapPin, Star, Clock, Phone, Globe, ChevronRight } from "lucide-react"

export default function DirectoryHome() {
  return (
    <div className="min-h-screen bg-[#001219]">
      {/* Header */}
      <header className="border-b border-[#005F73] bg-[#001219]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-[#E9D8A6]">the lawless directory</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Restaurants
                </a>
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Services
                </a>
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Shopping
                </a>
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Entertainment
                </a>
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Health & Wellness
                </a>
                <a href="#" className="text-[#94D2BD] hover:text-[#EE9B00] transition-colors">
                  Professional
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" className="text-[#94D2BD] hover:text-[#EE9B00] hover:bg-[#005F73]">
                List Your Business
              </Button>
              <Button className="bg-[#EE9B00] hover:bg-[#CA6702] text-[#001219]">Get Started</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#001219] to-[#005F73] py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl font-bold text-[#E9D8A6] mb-6 leading-tight">
                Discover Local Businesses That Matter
              </h2>
              <p className="text-xl text-[#94D2BD] mb-8 leading-relaxed">
                Find authentic, community-driven businesses in your area. From hidden gems to established favorites, we
                connect you with the places that make your neighborhood unique.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#005F73] h-5 w-5" />
                  <Input
                    placeholder="Search businesses, services, or categories..."
                    className="pl-10 bg-[#E9D8A6] border-[#0A9396] text-[#001219] placeholder:text-[#005F73]"
                  />
                </div>
                <Button className="bg-[#EE9B00] hover:bg-[#CA6702] text-[#001219] px-8">Explore Directory</Button>
              </div>
            </div>
            <div className="relative">
              <img src="/modern-storefront.png" alt="Local business directory" className="rounded-lg shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-16 bg-[#005F73]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-[#E9D8A6] mb-4">Featured Categories</h3>
            <p className="text-[#94D2BD] text-lg">Explore businesses by category</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Restaurants & Cafes", count: "247 businesses", icon: "🍽️" },
              { name: "Professional Services", count: "189 businesses", icon: "💼" },
              { name: "Health & Wellness", count: "156 businesses", icon: "🏥" },
              { name: "Shopping & Retail", count: "203 businesses", icon: "🛍️" },
            ].map((category, index) => (
              <Card
                key={index}
                className="bg-[#0A9396] border-[#94D2BD] hover:bg-[#94D2BD] transition-colors cursor-pointer group"
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-4">{category.icon}</div>
                  <h4 className="font-semibold text-[#001219] mb-2 group-hover:text-[#005F73]">{category.name}</h4>
                  <p className="text-[#005F73] text-sm group-hover:text-[#001219]">{category.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Businesses */}
      <section className="py-16 bg-[#001219]">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h3 className="text-3xl font-bold text-[#E9D8A6] mb-4">Featured Businesses</h3>
              <p className="text-[#94D2BD]">Discover standout local businesses in your community</p>
            </div>
            <Button
              variant="outline"
              className="border-[#EE9B00] text-[#EE9B00] hover:bg-[#EE9B00] hover:text-[#001219] bg-transparent"
            >
              View All <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Artisan Coffee Roasters",
                category: "Coffee & Tea",
                rating: 4.8,
                reviews: 127,
                address: "Downtown District",
                phone: "(555) 123-4567",
                image: "/cozy-brick-cafe.png",
                featured: true,
              },
              {
                name: "Green Valley Wellness Center",
                category: "Health & Wellness",
                rating: 4.9,
                reviews: 89,
                address: "Midtown Area",
                phone: "(555) 987-6543",
                image: "/modern-wellness-center.png",
                featured: false,
              },
              {
                name: "Handcrafted Furniture Co.",
                category: "Home & Garden",
                rating: 4.7,
                reviews: 156,
                address: "Arts Quarter",
                phone: "(555) 456-7890",
                image: "/artisan-furniture-workshop.png",
                featured: true,
              },
            ].map((business, index) => (
              <Card
                key={index}
                className="bg-[#005F73] border-[#0A9396] hover:border-[#EE9B00] transition-colors group"
              >
                <div className="relative">
                  <img
                    src={business.image || "/placeholder.svg"}
                    alt={business.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  {business.featured && (
                    <Badge className="absolute top-3 left-3 bg-[#EE9B00] text-[#001219]">Featured</Badge>
                  )}
                </div>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-[#E9D8A6] group-hover:text-[#EE9B00] transition-colors">
                        {business.name}
                      </CardTitle>
                      <CardDescription className="text-[#94D2BD]">{business.category}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-[#EE9B00] text-[#EE9B00]" />
                      <span className="text-[#E9D8A6] font-medium">{business.rating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-[#94D2BD]">
                      <MapPin className="h-4 w-4 mr-2" />
                      {business.address}
                    </div>
                    <div className="flex items-center text-[#94D2BD]">
                      <Phone className="h-4 w-4 mr-2" />
                      {business.phone}
                    </div>
                    <div className="flex items-center text-[#94D2BD]">
                      <Star className="h-4 w-4 mr-2" />
                      {business.reviews} reviews
                    </div>
                  </div>
                  <Button className="w-full mt-4 bg-[#0A9396] hover:bg-[#EE9B00] text-[#E9D8A6] hover:text-[#001219]">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-[#005F73]">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-3xl font-bold text-[#E9D8A6] mb-4">
              Get the best of The Lawless Directory, right in your inbox
            </h3>
            <p className="text-[#94D2BD] mb-8">
              Stay updated with new business listings, community events, and local insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                placeholder="Enter email address"
                className="flex-1 bg-[#E9D8A6] border-[#0A9396] text-[#001219] placeholder:text-[#005F73]"
              />
              <Button className="bg-[#EE9B00] hover:bg-[#CA6702] text-[#001219]">Subscribe</Button>
            </div>
            <p className="text-xs text-[#94D2BD] mt-4">
              Read more in our{" "}
              <a href="#" className="text-[#EE9B00] hover:underline">
                Privacy Policy
              </a>
              . Unsubscribe at any time.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Additions */}
      <section className="py-16 bg-[#001219]">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h3 className="text-3xl font-bold text-[#E9D8A6] mb-4">Recently Added</h3>
              <p className="text-[#94D2BD]">New businesses joining our community</p>
            </div>
            <Button
              variant="outline"
              className="border-[#EE9B00] text-[#EE9B00] hover:bg-[#EE9B00] hover:text-[#001219] bg-transparent"
            >
              View All <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Urban Bike Repair",
                category: "Automotive & Transport",
                addedDate: "3 days ago",
                image: "/bike-repair-shop.png",
              },
              {
                name: "Sunset Yoga Studio",
                category: "Health & Wellness",
                addedDate: "5 days ago",
                image: "/peaceful-yoga-studio.png",
              },
              {
                name: "Local Harvest Market",
                category: "Food & Grocery",
                addedDate: "1 week ago",
                image: "/placeholder-0pa7q.png",
              },
              {
                name: "Digital Design Studio",
                category: "Professional Services",
                addedDate: "1 week ago",
                image: "/modern-design-studio.png",
              },
            ].map((business, index) => (
              <Card key={index} className="bg-[#005F73] border-[#0A9396] hover:border-[#EE9B00] transition-colors">
                <div className="relative">
                  <img
                    src={business.image || "/placeholder.svg"}
                    alt={business.name}
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                  <Badge className="absolute top-2 right-2 bg-[#94D2BD] text-[#001219] text-xs">New</Badge>
                </div>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-[#E9D8A6] mb-1">{business.name}</h4>
                  <p className="text-[#94D2BD] text-sm mb-2">{business.category}</p>
                  <div className="flex items-center text-xs text-[#0A9396]">
                    <Clock className="h-3 w-3 mr-1" />
                    Added {business.addedDate}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#005F73] border-t border-[#0A9396] py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold text-[#E9D8A6] mb-4">The Lawless Directory</h4>
              <p className="text-[#94D2BD] text-sm mb-4">
                Connecting communities with authentic local businesses since 2024.
              </p>
              <div className="flex space-x-4">
                <Globe className="h-5 w-5 text-[#EE9B00]" />
                <span className="text-[#94D2BD] text-sm">lawlessdirectory.com</span>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-[#E9D8A6] mb-4">Categories</h5>
              <ul className="space-y-2 text-sm text-[#94D2BD]">
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Restaurants
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Shopping
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Entertainment
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-[#E9D8A6] mb-4">For Businesses</h5>
              <ul className="space-y-2 text-sm text-[#94D2BD]">
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    List Your Business
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Business Resources
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Success Stories
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-[#E9D8A6] mb-4">Support</h5>
              <ul className="space-y-2 text-sm text-[#94D2BD]">
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-[#EE9B00] transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#0A9396] mt-8 pt-8 text-center">
            <p className="text-[#94D2BD] text-sm">© 2024 The Lawless Directory. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
